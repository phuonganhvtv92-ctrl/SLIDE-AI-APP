/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Sử dụng giới hạn payload cho việc upload file base64
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Khởi tạo Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Endpoint 1: Trả về trạng thái hoạt động của Server
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Endpoint 2: Phân tích tài liệu và sinh cấu trúc Slide bằng AI Gemini
app.post("/api/generate-slides", async (req, res): Promise<any> => {
  try {
    const { 
      fileBase64, 
      fileName, 
      mimeType, 
      customPrompt, 
      language = "vi",
      slideCount = 10,
      presentationStyle = "academic",
      themeId = "academic-blue",
      themeName = "Academic Blue (Xanh Học Thuật)",
      imageOption = "smart"
    } = req.body;

    let targetText = "";
    const geminiContentParts: any[] = [];
    const extractedImages: string[] = [];

    // Nếu có file đính kèm
    if (fileBase64 && mimeType) {
      console.log(`Nhận tệp: ${fileName} (${mimeType})`);

      // 1. Nếu là tệp Word (.docx), chúng ta dùng mammoth để trích xuất text thô trước
      if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName?.endsWith(".docx")
      ) {
        try {
          const docBuffer = Buffer.from(fileBase64, "base64");
          const mammothResult = await mammoth.extractRawText({ buffer: docBuffer });
          targetText = mammothResult.value;
          console.log(`Đã trích xuất Word: ${targetText.substring(0, 100)}...`);
          geminiContentParts.push({
            text: `Dưới đây là nội dung văn bản học thuật được trích xuất từ tài liệu Word của tôi để bạn phân tích và tạo bài giảng:\n\n${targetText}`,
          });

          // Trích xuất thêm các tệp ảnh nhúng trong file Word bằng conertToHtml
          try {
            await mammoth.convertToHtml({ buffer: docBuffer }, {
              convertImage: mammoth.images.imgElement((image) => {
                return image.read("base64").then((imageBuffer) => {
                  const dataUri = `data:${image.contentType};base64,${imageBuffer}`;
                  extractedImages.push(dataUri);
                  return {
                    src: dataUri
                  };
                });
              })
            });
            console.log(`Đã trích xuất phát hiện thấy ${extractedImages.length} ảnh tự động trong tài liệu Word.`);
          } catch (htmlErr) {
            console.error("Lỗi trích xuất ảnh từ Word:", htmlErr);
          }
        } catch (docxErr: any) {
          console.error("Lỗi khi giải mã tài liệu Word:", docxErr);
          return res.status(400).json({ error: "Không thể trích xuất văn bản từ tệp Word: " + docxErr.message });
        }
      } 
      // 2. Nếu là PDF hoặc hình ảnh, chuyển trực tiếp cho mô hình Gemini đa phương thức xử lý (Multimodal)
      else if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
        geminiContentParts.push({
          inlineData: {
            data: fileBase64,
            mimeType: mimeType,
          },
        });
        geminiContentParts.push({
          text: "Vui lòng phân tích tệp tài liệu này (PDF hoặc hình ảnh) trực tiếp để tổng hợp kiến thức cốt lõi.",
        });

        if (mimeType.startsWith("image/")) {
          // Lưu lại chính ảnh này để chèn vào các slide liên quan
          extractedImages.push(`data:${mimeType};base64,${fileBase64}`);
        }
      } 
      // 3. Nếu là tệp text đơn thuần
      else {
        const textStr = Buffer.from(fileBase64, "base64").toString("utf-8");
        geminiContentParts.push({
          text: `Dưới đây là văn bản tài liệu dạng text thô:\n\n${textStr}`,
        });
      }
    }

    // Dynamic style definitions based on user selection
    let styleInstruction = "";
    switch (presentationStyle) {
      case "academic":
        styleInstruction = "Phong cách SƯ PHẠM / HỌC THUẬT: Ngôn từ mô phạm, sâu sắc, trích dẫn học thuật giàu ý nghĩa, bố cục mạch luận chia rõ đề mục đứng lớp giảng dạy một cách kinh điển.";
        break;
      case "business":
        styleInstruction = "Phong cách DOANH NGHIỆP / KINH DOANH (Business): Ngôn từ chuyên nghiệp, dứt khoát, thực chiến, tập trung sâu vào số liệu thống kê, quy trình, kết quả cụ thể và mô hình tối ưu.";
        break;
      case "cinematic":
        styleInstruction = "Phong cách ĐIỆN ẢNH (Cinematic): Ngôn từ bay bổng truyền cảm hứng cực kỳ sâu sắc, tương phản kịch tính, sử dụng câu quote nổi tiếng kết hợp mô tả trực diện đậm tính nghệ thuật.";
        break;
      case "startup pitch":
        styleInstruction = "Phong cách PITCH DECK KHỞI NGHIỆP: Thể ngắt câu dồn dập quyết đoán, tập trung cao vào Vấn đề (Problem), Giải pháp (Solution), Mô hình kinh doanh, doanh thu mục tiêu và tiềm năng tăng trưởng mạng lưới.";
        break;
      case "minimal":
        styleInstruction = "Phong cách TỐI GIẢN (Minimalist): Nội dung cô đọng cực kỳ súc tích, cắt tỉa tối đa từ thừa, chắt lọc nội dung cốt tủy siêu ngắn gọn, tạo ra khoảng thở tinh hoa.";
        break;
      case "modern":
        styleInstruction = "Phong cách HIỆN ĐẠI (Modern Trend): Trẻ trung, năng động, bám sát các luồng tư duy công nghệ AI mới nhất và thiết kế sáng tạo đột phá.";
        break;
      default:
        styleInstruction = "Phong cách chuyên nghiệp, súc tích và mạch lạc.";
    }

    let imageOptionInstruction = "";
    switch (imageOption) {
      case "none":
        imageOptionInstruction = `
          QUY TẮC ĐẶC BIỆT CHỈ ĐỊNH: KHÔNG SỬ DỤNG HÌNH ẢNH TRÊN SLIDE (Strictly NO Images).
          - Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC thiết lập trường "imageUrl" cho bất kỳ slide nào (luôn đặt trường này là chuỗi rỗng "").
          - Không điền từ khóa "imageKeywords" hoặc đặt là rỗng "".
          - Cấu trúc slide sẽ hoàn toàn là chữ (text) súc tích, tinh gọn, mô phạm sư phạm và có khoảng thở thoáng đạt tối đa.
        `;
        break;
      case "realistic":
        imageOptionInstruction = `
          QUY TẮC ĐẶC BIỆT CHỈ ĐỊNH: CHỈ CHẤP NHẬN ẢNH THẬT (Only Realistic/Actual Photos).
          - Toàn bộ hình ảnh được đề xuất qua "imageUrl" và "imageKeywords" phải là ảnh chụp đời thực, ảnh tư liệu thật, ảnh chụp hiện vật hoặc môi trường thực tế (Ví dụ: ảnh chụp thiết bị thí nghiệm khoa học thực tế, phòng họp doanh nghiệp thực chiến, cảnh quan địa lý chân thực).
          - Tránh các ảnh chụp nghệ thuật quá mức gây hoang mang, và tuyệt đối nghiêm cấm hoàn toàn ảnh dạng anime, hoạt hình, clipart vẽ tay hoặc tranh minh họa 3D trừu tượng.
        `;
        break;
      case "internet":
        imageOptionInstruction = `
          QUY TẮC ĐẶC BIỆT CHỈ ĐỊNH: ẢNH LẤY TỪ INTERNET (Internet Search Images).
          - Thiết lập "imageKeywords" là 1-2 từ khóa tiếng Anh thích hợp mô tả ảnh tìm kiếm thực tế sinh động bám sát kiến thức bài giảng để hệ thống liên kết tới ảnh phù hợp nhất từ Internet.
        `;
        break;
      case "ai_gen":
        imageOptionInstruction = `
          QUY TẮC ĐẶC BIỆT CHỈ ĐỊNH: ẢNH DO AI SÁNG TẠO (AI Generated/Digital Art Style).
          - Hướng đến phong cách ảnh sáng tạo của AI, hình vẽ nghệ thuật số tinh xảo (digital art style), mô phỏng 3D render cao cấp mang tính giả định hoặc công nghệ cao sáng tạo (Ví dụ: nền vi mạch tương lai, sơ đồ AI mô học trừu tượng). Hoàn toàn không dùng clipart rác hay ảnh chất lượng thấp.
        `;
        break;
      case "icon":
        imageOptionInstruction = `
          QUY TẮC ĐẶC BIỆT CHỈ ĐỊNH: CHỈ SỬ DỤNG ICON MINH HỌA (Illustration Icons Only).
          - Bạn TUYỆT ĐỐI KHÔNG ĐƯỢC chỉ định trường "imageUrl" (luôn để trống "").
          - Slide chỉ sử dụng các icon minh họa tinh giản và súc tích để tránh gây rối bố cục tối giản. Trong thuộc tính "visualAid", hãy bắt buộc thiết lập type là "icon" và chọn một Lucide icon tiếng Anh thích hợp súc tích giúp giảng dạy hữu ích.
        `;
        break;
      case "smart":
      default:
        imageOptionInstruction = `
          QUY TẮC ĐẶC BIỆT CHỈ ĐỊNH: AI TỰ CHỌN THÔNG MINH (Smart AI Selection).
          - Tùy biến linh hoạt theo nội dung thực giảng: slide khái niệm lý thuyết dùng icon, slide dữ liệu số dùng diagram/statistic, và slide giới thiệu ứng dụng dùng ảnh tư liệu thực tế bám sát kiến thức bài học.
        `;
        break;
    }

    // Ghép prompt bổ sung của người dùng (nếu có)
    const promptInstructions = `
      Hãy thiết kế một bộ slide bài giảng/thuyết trình gồm chính xác **${slideCount} slide** (không dư không thiếu) dựa trên tài liệu hoặc yêu cầu được cung cấp bên trên.
      
      YÊU CẦU BẮT BUỘC VỀ BẢO TOÀN CẤU TRÚC VÀ TIẾN TRÌNH TÀI LIỆU GỐC (Preserve Original Document Structure):
      - Giữ nguyên các tiêu đề chương/mục (chapter titles, section headings).
      - Giữ nguyên thứ tự bài học, bài giảng theo đúng dòng chảy ý của tài liệu nguồn (lesson order, teaching flow).
      - Phát hiện tự động các phần trọng tâm để phân bổ số lượng slide hợp lý trên tổng số ${slideCount} slide.
      - Sử dụng layout "divider" (Chapter divider slide) khi chuyển sang một chương mới hoặc một phần lớn mới để phân tách rõ ràng cấu trúc bài giảng.
      - Sử dụng layout "summary" trước slide kết luận hoặc cuối chương để tóm tắt các điểm then chốt đã học.
      
      YÊU CẦU TÓM LƯỢC NỘI DUNG THÔNG MINH (Intelligent Content Summarization):
      - Trích lọc các luận điểm cốt tủy nhất dưới dạng bullet points (content), tuyệt đối trích dứt khoát không viết đoạn văn dài.
      - Mỗi gạch đầu dòng chỉ từ 5-15 từ, thoáng, súc tích, dễ nhớ cho người học, sử dụng ngôn từ lý luận sư phạm chuẩn mực. 
      - Giữ nguyên chính xác ý nghĩa học thuật, bám sát các định nghĩa, khái niệm kinh điển.
      - Phân chia cân đối: MỖI SLIDE CHỈ THỂ HIỆN MỘTÝ TƯỞNG CHỦ ĐẠO (one main idea per slide) để tránh nhồi nhét chữ quá nhiều, giữ không gian thoáng cho slide.
 
      YÊU CẦU VỀ HÌNH ẢNH GỐC (Image Handling):
      - Chúng tôi đã phát hiện/trích xuất được ${extractedImages.length} ảnh gốc từ tài liệu của bạn.
      - Khi thiết kế slide, nếu nội dung slide liên quan trực tiếp đến một trong các ảnh này, hãy đặt trường "imageUrl" thành "@original_image_<index_number>" (Ví dụ: "@original_image_0", "@original_image_1", ... tương ứng với thứ tự ảnh).
      - Đặt "imageUrl" là "@original_image_<index_number>" cho các bức ảnh này để hệ thống tự động tải và hiển thị bản ảnh rõ nét nhất lên slide.
      - Chỉ đề xuất ảnh LoremFlickr hoặc từ khóa hình ảnh tiếng Anh cho các slides không có ảnh gốc tương ứng.
 
      QUY TẮC NGHIÊM NGẶT VỀ HÌNH ẢNH TRÊN SLIDE (Strict Visual & Image Rules):
      Chỉ sử dụng hình ảnh phục vụ trực tiếp cho nội dung bài giảng.
      
      ${imageOptionInstruction}
      
      BẮT BUỘC hình ảnh phải:
      - Liên quan sâu sắc đến kiến thức bài học kỹ thuật/học thuyết.
      - Hỗ trợ học viên/người học dễ dàng tiếp thu, hiểu rõ nội dung cốt lõi.
      - Có phong cách chuyên nghiệp, sư phạm đứng đắn, rõ ràng, sạch sẽ, tối tân.
      - Tuyệt đối phù hợp với môi trường giáo dục cao cấp và học thuật nghiêm túc.
 
      TUYỆT ĐỐI CẤM SỬ DỤNG (Strict Negations - Prohibited Images):
      - Không sử dụng ảnh ngẫu nhiên, mô tả hời hợt hoặc không liên quan trực tiếp.
      - Tuyệt đối không dùng ảnh phong cách Anime, hoạt hình không chuẩn học thuật.
      - Tuyệt đối không dùng ảnh Meme, ảnh hài hước, giải trí quá rườm rà.
      - Tránh các loại ảnh nghệ thuật trừu tượng quá mức gây hoang mang cho người xem.
      - Tuyệt đối không dùng ảnh gây nhiễu loạn nội dung hoặc cản trở trực quan.
      - Tuyệt đối không dùng ảnh người mẫu tạo dáng không liên quan gì đến bài học thực tế.
      - Không lấy ảnh chất lượng thấp, ảnh dính Watermark bản quyền hoặc ảnh quá nhiều chi tiết vụn vặt gây rối mắt.
      - Mỗi slide chỉ nên có hình ảnh khi thật sự cần thiết. Ưu tiên hàng đầu cho bố cục tối giản, không gian thở, học thuật cao cấp và cực kỳ dễ đọc.

      YÊU CẦU ĐẶC BIỆT VỀ KIỂU DÁNG slide:
      - Phong cách trình diễn yêu cầu: ${styleInstruction}
      - Thiết kế phối màu chủ đạo: Phù hợp với tông màu của bộ theme "${themeName}" (mã màu: ${themeId}).
      
      Yêu cầu bắt buộc về kết cấu và bố cục sư phạm:
      - Đối tượng học sinh/sinh viên tiếp thu bằng trực quan. Tránh tuyệt đối nhồi nhét chữ quá nhiều.
      - Sử dụng font chữ mặc định là Times New Roman với cỡ chữ lớn và thoáng (chuẩn 28pt cho các gạch đầu dòng). Do đó các gạch đầu dòng 'content' phải cực kỳ tối giản, súc tích (chỉ từ 5-15 từ mỗi dòng). Tránh viết câu dài dòng hoặc đoạn văn.
      - Slide 1: Bắt buộc là slide Tiêu đề ("title" layout), giới thiệu bài học, tên bài giảng.
      - Slide 2: Slide giới thiệu mục tiêu bài học hoặc sơ đồ bài giảng ("intro" hoặc "two_column" layout).
      - Các slide tiếp theo: Phân chia nội dung bài giảng một cách hợp lý và logic dựa trên tổng số ${slideCount} slide cần tạo, sử dụng linh hoạt và luân phiên các kiểu layout (points, two_column, stats, quote, divider, summary) để bài thuyết trình trở nên sinh động, không bị nhàm chán.
      - Slide cuối (Slide ${slideCount}): Bắt buộc là slide kết luận tóm tắt bài giảng hoặc câu hỏi ôn tập ("conclusion" layout).
      - Mỗi slide cần có từ 2 đến tối đa 5 ý điểm chính ("content").
      - Tự động gợi ý thiết bị trực quan phù hợp ("visualAid") gồm biểu tượng (icon), sơ đồ, trích dẫn phù hợp với môn học. Ở phần visualAid, hãy đề xuất các dữ liệu phù hợp với phong cách và layout của slide đó (ví dụ: nếu là stats layout thì bắt buộc có 'statNumber' dạng số phần trăm hoặc số nổi bật và 'statLabel' mô tả).
      - Tự động tìm kiếm và bổ sung ảnh minh họa trực quan liên quan trực tiếp đến nội dung slide ("imageUrl" và "imageKeywords"). "imageKeywords" là 1-2 từ khóa tiếng Anh ngắn gọn và dễ hiểu nhất cho chủ đề của slide đó (ví dụ: "education", "robotics", "microscope", "globe", "finance"). "imageUrl" là đường dẫn ảnh lấy mẫu từ LoremFlickr chuẩn: "https://loremflickr.com/640/480/<imageKeywords>".

      Tập trung sinh tiếng Việt đầy đủ Unicode, văn phong học thuật, mô phạm, truyền cảm hứng của giáo viên.
      
      Lời căn dặn tùy biến thêm của giáo viên (nếu có): ${customPrompt || "Hãy làm bài giảng thật tinh gọn, lý luận chuẩn mực và bổ ích."}
    `;

    geminiContentParts.push({ text: promptInstructions });

    console.log(`Đang bắt đầu gọi Gemini API để tạo ${slideCount} slide phong cách ${presentationStyle}...`);

    // Gọi Gemini API bằng schema có sẵn để định dạng JSON đầu ra
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: geminiContentParts,
      config: {
        systemInstruction: "Bạn là chuyên gia thiết kế sư phạm bài giảng đứng lớp chuyên nghiệp cho giảng viên đại học và giáo viên THPT.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Tiêu đề ngắn gọn của slide (dưới 10 từ)." },
              layout: {
                type: Type.STRING,
                enum: ["title", "intro", "points", "two_column", "quote", "stats", "conclusion", "divider", "summary"],
                description: "Kiểu bố cục phù hợp nhất cho nội dung slide. 'divider' dùng khi bắt đầu chương/mục lớn mới, 'summary' dùng để tổng kết chương.",
              },
              content: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách 2-5 ý tóm tắt ngắn gọn súc tích (mỗi ý 5-15 từ, chuẩn sfont chữ Times New Roman 28pt lý tưởng).",
              },
              imageUrl: {
                type: Type.STRING,
                description: "Đường dẫn ảnh minh họa từ LoremFlickr liên quan đến slide, định dạng: https://loremflickr.com/640/480/<imageKeywords> hoặc đặt là '@original_image_i' nếu khớp ảnh nguồn."
              },
              imageKeywords: {
                type: Type.STRING,
                description: "1-2 từ khóa tiếng Anh ngắn gọn và đơn giản, cách nhau bởi dấu gạch ngang (ví dụ: 'ai-concept', 'classroom', 'globe', 'molecule', 'history')."
              },
              visualAid: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["icon", "process", "quote", "statistic", "diagram"] },
                  icon: { type: Type.STRING, description: "Tên một Lucide icon tiếng Anh thích hợp giúp người dùng hiển thị hình họa trực quan như: Presentation, BookOpen, Clock, Heart, Award, GraduationCap, Target, Lightbulb, Shield, Briefcase, HelpCircle, BarChart, Settings, FileText, Globe, CheckCircle, AlertTriangle, Users." },
                  description: { type: Type.STRING, description: "Mô tả chi tiết bằng tiếng Việt về cách thể hiện sơ đồ, tranh ảnh minh họa sư phạm cho giáo viên." },
                  header: { type: Type.STRING, description: "Tiêu đề phụ hoặc thông số nổi bật." },
                  statNumber: { type: Type.STRING, description: "Số thống kê chính nổi bật nếu là layout 'stats' (Ví dụ: '95%', '100%')." },
                  statLabel: { type: Type.STRING, description: "Nhãn tóm tắt ý nghĩa cho số thống kê bên trên." }
                },
                required: ["type", "icon", "description"]
              }
            },
            required: ["title", "layout", "content"]
          }
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Không nhận được dữ liệu phản hồi từ AI.");
    }

    console.log("Xử lý phản hồi JSON thành công.");
    const slidesData = JSON.parse(outputText.trim());

    // Thay thế các nhãn ảnh gốc bằng base64 thực chất để hiển thị và tải trực tiếp
    if (Array.isArray(slidesData)) {
      slidesData.forEach((slide: any) => {
        // Áp dụng bộ lọc nghiêm ngặt theo lựa chọn của người dùng
        if (imageOption === "none" || imageOption === "icon") {
          slide.imageUrl = "";
          slide.imageKeywords = "";
        }
        if (imageOption === "icon") {
          if (!slide.visualAid) {
            slide.visualAid = {
              type: "icon",
              icon: "BookOpen",
              description: "Biểu tượng học thuật minh họa trực quan chủ đề chính."
            };
          } else {
            slide.visualAid.type = "icon";
            if (!slide.visualAid.icon) {
              slide.visualAid.icon = "BookOpen";
            }
          }
        }

        if (slide.imageUrl && slide.imageUrl.includes("@original_image_")) {
          const match = slide.imageUrl.match(/@original_image_(\d+)/);
          if (match && match[1]) {
            const idx = parseInt(match[1], 10);
            if (!isNaN(idx) && extractedImages[idx]) {
              slide.imageUrl = extractedImages[idx];
              console.log(`[IMAGE BINDING] Đã gắn thành công ảnh gốc #${idx} vào slide: ${slide.title}`);
            } else {
              if (imageOption === "none" || imageOption === "icon") {
                slide.imageUrl = "";
              } else {
                slide.imageUrl = `https://loremflickr.com/640/480/${slide.imageKeywords || "education"}`;
              }
            }
          }
        }
      });
    }

    return res.json({ slides: slidesData });

  } catch (error: any) {
    console.error("Lỗi khi gọi Gemini API:", error);
    return res.status(500).json({ error: error.message || "Lỗi xử lý hệ lý thuyết AI của Server." });
  }
});

// Khởi chạy Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[FULLSTACK] Server đang phát triển tại http://localhost:${PORT}`);
  });
}

startServer();
