/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import pptxgen from "pptxgenjs";
import { SlideData, ThemePreset } from "../types";
import { normalizeVietnameseText } from "./textUtils";

// Hàm hỗ trợ loại bỏ ký tự '#' khỏi mã màu Hex để PPTXGenJS nhận dạng chính xác
const cleanColor = (hex: string): string => {
  if (hex.startsWith("#")) {
    return hex.substring(1).toUpperCase();
  }
  return hex.toUpperCase();
};

/**
 * Xuất danh sách Slide ra tệp PowerPoint (.pptx) chuẩn trường học
 * @param slides Danh sách các slide được AI sinh ra
 * @param theme ThemePreset màu thiết kế do người dùng chọn
 * @param title_presentation Tiêu đề file
 */
export function exportToPowerPoint(
  _slides: SlideData[],
  theme: ThemePreset,
  title_presentation: string = "Bai_Giang_Chuyen_Nghiep"
) {
  // Chuẩn hóa toàn bộ nội dung văn bản Tiếng Việt trước khi xuất bản thành tệp PowerPoint
  const slides = _slides.map(slide => ({
    ...slide,
    title: normalizeVietnameseText(slide.title || ""),
    content: Array.isArray(slide.content) ? slide.content.map(text => normalizeVietnameseText(text || "")) : [],
    visualAid: slide.visualAid ? {
      ...slide.visualAid,
      description: normalizeVietnameseText(slide.visualAid.description || ""),
      statLabel: slide.visualAid.statLabel ? normalizeVietnameseText(slide.visualAid.statLabel) : undefined,
    } : undefined
  }));

  const pptx = new pptxgen();

  // Đặt tỉ lệ slide chuẩn thời thượng 16:9
  pptx.layout = "LAYOUT_16x9";

  // Tạo tiêu đề meta file
  pptx.author = "AI PowerPoint Slide Generator";
  pptx.company = "Giảng Viên AI";
  pptx.title = title_presentation;

  const bgHex = cleanColor(theme.backgroundColor);
  const titleHex = cleanColor(theme.titleColor);
  const textHex = cleanColor(theme.textColor);
  const accentHex = cleanColor(theme.accentColor);
  const borderHex = cleanColor(theme.borderColor);

  // Helper hàm hỗ trợ thêm ảnh an toàn chống lỗi crash
  const addSlideImage = (s: pptxgen.Slide, url: string, x: any, y: any, w: any, h: any) => {
    try {
      if (url.startsWith("data:image")) {
        s.addImage({
          data: url,
          x: x,
          y: y,
          w: w,
          h: h
        });
      } else {
        s.addImage({
          path: url,
          x: x,
          y: y,
          w: w,
          h: h
        });
      }
    } catch (err) {
      console.error("Error adding slide image to PPTX:", err);
    }
  };

  // Helper hàm tinh chỉnh kích thước chữ Bullet thông minh tương ứng với lượng text
  const getStructuredBullets = (bullets: string[], colorHex: string) => {
    const count = bullets.length;
    const longest = Math.max(...bullets.map(b => b.length), 0);
    
    // Sử dụng cỡ chữ học thuật lý tưởng để vừa vặn khung hình 16:9
    let size = 22;
    if (count <= 2 && longest < 70) {
      size = 26;
    } else if (count >= 4 || longest > 120) {
      size = 18;
    } else if (count >= 5 || longest > 180) {
      size = 16;
    }
    
    return bullets.map(text => ({
      text: text,
      options: {
        fontFace: "Times New Roman",
        fontSize: size,
        color: colorHex
      }
    }));
  };

  slides.forEach((slide, index) => {
    const s = pptx.addSlide();

    // Thiết lập màu nền slide
    s.background = { fill: bgHex };

    // Thêm số trang (Slide Number) nhỏ góc cuối slide
    s.addText(`${index + 1} / ${slides.length}`, {
      x: "93%",
      y: "92%",
      w: "5%",
      h: "5%",
      fontFace: "Times New Roman",
      fontSize: 12,
      color: textHex,
      align: "right",
    });

    const layout = slide.layout;

    switch (layout) {
      case "title": {
        // --- 1. SLIDE TIÊU CHÍ CHÍNH (VERTICAL ALIGN CENTER) ---
        const hasImg = !!slide.imageUrl;

        if (hasImg) {
          // Bố cục phân chia cân đối: Trái chữ, Phải ảnh
          s.addShape(pptx.ShapeType.rect, {
            x: "5%",
            y: "28%",
            w: "45%",
            h: 0.08,
            fill: { color: accentHex },
          });

          s.addText(slide.title, {
            x: "5%",
            y: "32%",
            w: "45%",
            h: 2.2,
            fontFace: "Times New Roman",
            fontSize: 38,
            color: titleHex,
            bold: true,
            align: "left",
            valign: "middle",
          });

          const presenterText = slide.content.length > 0 
            ? slide.content.join(" | ") 
            : "Đại Học Sư Phạm - Bài Giảng Chuyên Nghiệp";
            
          s.addText(presenterText, {
            x: "5%",
            y: "58%",
            w: "45%",
            h: 1.0,
            fontFace: "Times New Roman",
            fontSize: 20,
            color: accentHex,
            align: "left",
            italic: true,
          });

          addSlideImage(s, slide.imageUrl!, "55%", "20%", "40%", "60%");
        } else {
          // Bố cục căn giữa truyền thống khi không có ảnh
          s.addShape(pptx.ShapeType.rect, {
            x: "5%",
            y: "28%",
            w: "90%",
            h: 0.08,
            fill: { color: accentHex },
          });

          s.addText(slide.title, {
            x: "5%",
            y: "32%",
            w: "90%",
            h: 2.2,
            fontFace: "Times New Roman",
            fontSize: 48,
            color: titleHex,
            bold: true,
            align: "center",
            valign: "middle",
          });

          const presenterText = slide.content.length > 0 
            ? slide.content.join(" | ") 
            : "Đại Học Sư Phạm - Bài Giảng Chuyên Nghiệp";
            
          s.addText(presenterText, {
            x: "5%",
            y: "56%",
            w: "90%",
            h: 1.0,
            fontFace: "Times New Roman",
            fontSize: 24,
            color: accentHex,
            align: "center",
            italic: true,
          });

          s.addShape(pptx.ShapeType.rect, {
            x: "35%",
            y: "72%",
            w: "30%",
            h: 0.04,
            fill: { color: borderHex },
          });
        }
        break;
      }

      case "intro": {
        // --- 2. SLIDE GIỚI THIỆU SƠ LƯỢC / MỤC TIÊU ---
        s.addText(slide.title, {
          x: "5%",
          y: "8%",
          w: "90%",
          h: 0.9,
          fontFace: "Times New Roman",
          fontSize: 36,
          color: titleHex,
          bold: true,
        });

        s.addShape(pptx.ShapeType.rect, {
          x: "5%",
          y: "18%",
          w: "15%",
          h: 0.06,
          fill: { color: accentHex },
        });

        // Cột trái: nội dung học thuật súc tích tự co giãn chữ
        const bullets = getStructuredBullets(slide.content, textHex);
        s.addText(bullets, {
          x: "5%",
          y: "25%",
          w: "50%",
          h: "63%",
          fontFace: "Times New Roman",
          bullet: true,
          valign: "top",
        });

        // Cột phải: Giáo cụ trực quan (Visual Aid) kết hợp ảnh minh họa thực tế
        const showVisualAid = !!slide.visualAid;
        const showImage = !!slide.imageUrl;

        if (showVisualAid || showImage) {
          s.addShape(pptx.ShapeType.rect, {
            x: "60%",
            y: "25%",
            w: "35%",
            h: "63%",
            fill: { color: bgHex },
            line: { color: borderHex, width: 2 },
          });

          if (showImage) {
            // Hiển thị ảnh minh họa sắc nét phía trên box giáo cụ
            addSlideImage(s, slide.imageUrl!, "62%", "28%", "31%", "32%");
            
            const labelText = slide.visualAid 
              ? `${slide.visualAid.icon.toUpperCase()} MINH HỌA\n\n${slide.visualAid.description}`
              : "ẢNH MINH HỌA BÀI HỌC THỰC TẾ";

            s.addText(labelText, {
              x: "62%",
              y: "62%",
              w: "31%",
              h: "24%",
              fontFace: "Times New Roman",
              fontSize: 14,
              color: textHex,
              align: "center",
              italic: true,
              valign: "top",
            });
          } else if (slide.visualAid) {
            s.addText(`[ ${slide.visualAid.icon} - Minh Họa ]`, {
              x: "62%",
              y: "28%",
              w: "31%",
              h: 0.6,
              fontFace: "Times New Roman",
              fontSize: 20,
              bold: true,
              color: accentHex,
              align: "center",
            });

            s.addText(slide.visualAid.description, {
              x: "62%",
              y: "36%",
              w: "31%",
              h: "48%",
              fontFace: "Times New Roman",
              fontSize: 16,
              color: textHex,
              align: "center",
              italic: true,
              valign: "middle",
            });
          }
        }
        break;
      }

      case "points": {
        // --- 3. SLIDE BỐ CỤC ĐIỂM CHÍNH ---
        s.addText(slide.title, {
          x: "5%",
          y: "8%",
          w: "90%",
          h: 0.9,
          fontFace: "Times New Roman",
          fontSize: 36,
          color: titleHex,
          bold: true,
        });

        s.addShape(pptx.ShapeType.rect, {
          x: "5%",
          y: "18%",
          w: "15%",
          h: 0.06,
          fill: { color: accentHex },
        });

        const bullets = getStructuredBullets(slide.content, textHex);
        s.addText(bullets, {
          x: "5%",
          y: "25%",
          w: "52%",
          h: "63%",
          fontFace: "Times New Roman",
          bullet: true,
          valign: "top",
        });

        const showVisualAid = !!slide.visualAid;
        const showImage = !!slide.imageUrl;

        if (showVisualAid || showImage) {
          s.addShape(pptx.ShapeType.roundRect, {
            x: "62%",
            y: "25%",
            w: "33%",
            h: "63%",
            fill: { color: borderHex },
          });

          if (showImage) {
            addSlideImage(s, slide.imageUrl!, "64%", "28%", "29%", "32%");
            
            const descText = slide.visualAid
              ? `Icon gợi ý: ${slide.visualAid.icon}\n\n${slide.visualAid.description}`
              : "Ý tưởng trực quan sinh động bổ trợ sâu vào bài giảng giảng đường.";

            s.addText(descText, {
              x: "64%",
              y: "62%",
              w: "29%",
              h: "24%",
              fontFace: "Times New Roman",
              fontSize: 14,
              color: titleHex,
              italic: true,
              valign: "top",
              align: "center"
            });
          } else if (slide.visualAid) {
            s.addText(`Ý tưởng trực quan:`, {
              x: "64%",
              y: "28%",
              w: "29%",
              h: 0.5,
              fontFace: "Times New Roman",
              fontSize: 18,
              bold: true,
              color: accentHex,
            });

            s.addText(`Icon gợi ý: ${slide.visualAid.icon}\n\n${slide.visualAid.description}`, {
              x: "64%",
              y: "34%",
              w: "29%",
              h: "50%",
              fontFace: "Times New Roman",
              fontSize: 16,
              color: titleHex,
              italic: true,
              valign: "top",
            });
          }
        }
        break;
      }

      case "two_column": {
        // --- 4. SLIDE SO SÁNH HAI CỘT ĐỐI CHIẾU ---
        s.addText(slide.title, {
          x: "5%",
          y: "8%",
          w: "90%",
          h: 0.9,
          fontFace: "Times New Roman",
          fontSize: 36,
          color: titleHex,
          bold: true,
        });

        s.addShape(pptx.ShapeType.rect, {
          x: "5%",
          y: "18%",
          w: "15%",
          h: 0.06,
          fill: { color: accentHex },
        });

        const showImage = !!slide.imageUrl;

        const midPoint = Math.ceil(slide.content.length / 2);
        const col1Texts = slide.content.slice(0, midPoint);
        const col2Texts = slide.content.slice(midPoint);

        const bulletsCol1 = getStructuredBullets(col1Texts, textHex);
        const bulletsCol2 = getStructuredBullets(col2Texts, textHex);

        if (showImage) {
          // Tiết giảm độ cao cột chữ để nhường chỗ cho ảnh căn giữa chân trang thanh lịch
          s.addText(bulletsCol1, {
            x: "5%",
            y: "25%",
            w: "42%",
            h: "36%",
            fontFace: "Times New Roman",
            bullet: true,
            valign: "top",
          });

          s.addShape(pptx.ShapeType.rect, {
            x: "50%",
            y: "26%",
            w: 0.02,
            h: "34%",
            fill: { color: borderHex },
          });

          s.addText(bulletsCol2, {
            x: "53%",
            y: "25%",
            w: "42%",
            h: "36%",
            fontFace: "Times New Roman",
            bullet: true,
            valign: "top",
          });

          addSlideImage(s, slide.imageUrl!, "32%", "64%", "36%", "25%");
        } else {
          s.addText(bulletsCol1, {
            x: "5%",
            y: "25%",
            w: "42%",
            h: "63%",
            fontFace: "Times New Roman",
            bullet: true,
            valign: "top",
          });

          s.addShape(pptx.ShapeType.rect, {
            x: "50%",
            y: "26%",
            w: 0.02,
            h: "60%",
            fill: { color: borderHex },
          });

          s.addText(bulletsCol2, {
            x: "53%",
            y: "25%",
            w: "42%",
            h: "63%",
            fontFace: "Times New Roman",
            bullet: true,
            valign: "top",
          });
        }
        break;
      }

      case "quote": {
        // --- 5. SLIDE KHUNG TRÍCH DẪN / SƯ PHẠM TRUYỀN CẢM HỨNG ---
        const showImage = !!slide.imageUrl;

        s.addText("“", {
          x: "8%",
          y: "14%",
          w: "15%",
          h: 1.0,
          fontFace: "Times New Roman",
          fontSize: 88,
          color: accentHex,
          bold: true,
        });

        s.addText(slide.title, {
          x: "10%",
          y: "25%",
          w: "80%",
          h: 0.6,
          fontFace: "Times New Roman",
          fontSize: 30,
          color: accentHex,
          bold: true,
          italic: true,
        });

        const quoteContent = slide.content.join("\n\n");
        
        if (showImage) {
          // Định dạng chữ quote gọn lại và dồn góc nhường diện tích cho ảnh minh họa truyền cảm hứng
          s.addText(quoteContent, {
            x: "10%",
            y: "32%",
            w: "80%",
            h: 2.5,
            fontFace: "Times New Roman",
            fontSize: 22,
            color: titleHex,
            italic: true,
            valign: "middle",
            align: "center"
          });

          addSlideImage(s, slide.imageUrl!, "40%", "65%", "20%", "23%");
        } else {
          s.addText(quoteContent, {
            x: "10%",
            y: "34%",
            w: "80%",
            h: 4.2,
            fontFace: "Times New Roman",
            fontSize: 28,
            color: titleHex,
            italic: true,
            valign: "middle",
          });
        }

        s.addText("”", {
          x: "88%",
          y: "71%",
          w: "10%",
          h: 1.0,
          fontFace: "Times New Roman",
          fontSize: 88,
          color: accentHex,
          bold: true,
          align: "right",
        });
        break;
      }

      case "stats": {
        // --- 6. SLIDE SỐ LIỆU THỐNG KÊ LỚN ---
        s.addText(slide.title, {
          x: "5%",
          y: "8%",
          w: "90%",
          h: 0.9,
          fontFace: "Times New Roman",
          fontSize: 36,
          color: titleHex,
          bold: true,
        });

        s.addShape(pptx.ShapeType.rect, {
          x: "5%",
          y: "18%",
          w: "15%",
          h: 0.06,
          fill: { color: accentHex },
        });

        const statNum = slide.visualAid?.statNumber || "95%";
        const statLbl = slide.visualAid?.statLabel || "Tỉ lệ hiểu bài của người nghe";
        const showImage = !!slide.imageUrl;

        if (showImage) {
          // Căn chỉnh ảnh đặt trên, số liệu lớn đặt dưới ở nửa trái màn hình
          addSlideImage(s, slide.imageUrl!, "12%", "23%", "30%", "20%");

          s.addText(statNum, {
            x: "5%",
            y: "43%",
            w: "45%",
            h: 2.0,
            fontFace: "Times New Roman",
            fontSize: 68,
            bold: true,
            color: accentHex,
            align: "center",
            valign: "middle",
          });

          s.addText(statLbl, {
            x: "5%",
            y: "68%",
            w: "45%",
            h: 1.0,
            fontFace: "Times New Roman",
            fontSize: 18,
            color: titleHex,
            align: "center",
            bold: true,
          });
        } else {
          s.addText(statNum, {
            x: "5%",
            y: "25%",
            w: "45%",
            h: 2.8,
            fontFace: "Times New Roman",
            fontSize: 90,
            bold: true,
            color: accentHex,
            align: "center",
            valign: "bottom",
          });

          s.addText(statLbl, {
            x: "5%",
            y: "55%",
            w: "45%",
            h: 1.2,
            fontFace: "Times New Roman",
            fontSize: 24,
            color: titleHex,
            align: "center",
            bold: true,
          });
        }

        const bullets = getStructuredBullets(slide.content, textHex);
        s.addText(bullets, {
          x: "53%",
          y: "25%",
          w: "42%",
          h: "63%",
          fontFace: "Times New Roman",
          bullet: true,
          valign: "top",
        });
        break;
      }

      case "conclusion": {
        // --- 7. SLIDE KẾT LUẬN / TỔNG KẾT ---
        s.addText(slide.title || "TỔNG KẾT BÀI HỌC", {
          x: "5%",
          y: "8%",
          w: "90%",
          h: 0.9,
          fontFace: "Times New Roman",
          fontSize: 36,
          color: titleHex,
          bold: true,
        });

        s.addShape(pptx.ShapeType.rect, {
          x: "5%",
          y: "18%",
          w: "15%",
          h: 0.06,
          fill: { color: accentHex },
        });

        const bullets = getStructuredBullets(slide.content, textHex);
        s.addText(bullets, {
          x: "5%",
          y: "26%",
          w: "52%",
          h: "63%",
          fontFace: "Times New Roman",
          bullet: true,
          valign: "top",
        });

        const showVisualAid = !!slide.visualAid;
        const showImage = !!slide.imageUrl;

        s.addShape(pptx.ShapeType.roundRect, {
          x: "62%",
          y: "26%",
          w: "33%",
          h: "63%",
          fill: { color: accentHex },
        });

        if (showImage) {
          addSlideImage(s, slide.imageUrl!, "64%", "29%", "29%", "31%");

          const helpText = slide.visualAid?.description || "Suy ngẫm kiến thức trọng tâm của chương và hoàn thành bài tập thực hành theo nhóm.";
          s.addText(helpText, {
            x: "64%",
            y: "62%",
            w: "29%",
            h: "24%",
            fontFace: "Times New Roman",
            fontSize: 14,
            color: bgHex,
            align: "center",
            bold: true,
            italic: true,
            valign: "top",
          });
        } else {
          s.addText("CÂU HỎI THẢO LUẬN / ÔN TẬP", {
            x: "64%",
            y: "30%",
            w: "29%",
            h: 0.8,
            fontFace: "Times New Roman",
            fontSize: 18,
            color: bgHex,
            bold: true,
            align: "center",
          });

          const helpText = slide.visualAid?.description || "Suy ngẫm kiến thức trọng tâm của chương và hoàn thành bài tập thực hành theo nhóm.";
          s.addText(helpText, {
            x: "64%",
            y: "38%",
            w: "29%",
            h: "48%",
            fontFace: "Times New Roman",
            fontSize: 16,
            color: bgHex,
            align: "center",
            bold: true,
            italic: true,
            valign: "top",
          });
        }
        break;
      }

      case "divider": {
        // --- Slide PHÂN CHIA CHƯƠNG / MỤC TIÊU MỚI ---
        s.addShape(pptx.ShapeType.rect, {
          x: "25%",
          y: "32%",
          w: "50%",
          h: 0.05,
          fill: { color: accentHex },
        });

        s.addText(slide.title, {
          x: "5%",
          y: "38%",
          w: "90%",
          h: 2.0,
          fontFace: "Times New Roman",
          fontSize: 44,
          color: titleHex,
          bold: true,
          align: "center",
          valign: "middle",
        });

        const dividerSubtexts = slide.content.join("   |   ");
        s.addText(dividerSubtexts, {
          x: "10%",
          y: "62%",
          w: "80%",
          h: 1.0,
          fontFace: "Times New Roman",
          fontSize: 18,
          color: accentHex,
          align: "center",
          italic: true,
        });

        if (slide.imageUrl) {
          addSlideImage(s, slide.imageUrl, "42%", "72%", "16%", "16%");
        }
        break;
      }

      case "summary": {
        // --- Slide TỔNG KẾT TỐM TẮT ĐIỂM CHÍNH ---
        s.addText(slide.title || "TỔNG KẾT CỐT LÕI BÀI HỌC", {
          x: "5%",
          y: "8%",
          w: "90%",
          h: 0.9,
          fontFace: "Times New Roman",
          fontSize: 36,
          color: titleHex,
          bold: true,
        });

        s.addShape(pptx.ShapeType.rect, {
          x: "5%",
          y: "18%",
          w: "15%",
          h: 0.06,
          fill: { color: accentHex },
        });

        const bulletsText = getStructuredBullets(slide.content, textHex);
        s.addText(bulletsText, {
          x: "5%",
          y: "26%",
          w: "52%",
          h: "63%",
          fontFace: "Times New Roman",
          bullet: { type: "number" },
          valign: "top",
        });

        const showImage = !!slide.imageUrl;
        if (showImage) {
          addSlideImage(s, slide.imageUrl!, "62%", "26%", "33%", "45%");
          s.addText("Hình ảnh trực quan tổng thể kiến thức", {
            x: "62%",
            y: "74%",
            w: "33%",
            h: 0.8,
            fontFace: "Times New Roman",
            fontSize: 14,
            color: textHex,
            align: "center",
            italic: true,
          });
        } else if (slide.visualAid) {
          s.addShape(pptx.ShapeType.roundRect, {
            x: "62%",
            y: "26%",
            w: "33%",
            h: "63%",
            fill: { color: borderHex },
          });

          s.addText(`Gợi ý giáo cụ trực quan:`, {
            x: "64%",
            y: "30%",
            w: "29%",
            h: 0.5,
            fontFace: "Times New Roman",
            fontSize: 18,
            bold: true,
            color: accentHex,
          });

          s.addText(slide.visualAid.description, {
            x: "64%",
            y: "38%",
            w: "29%",
            h: "45%",
            fontFace: "Times New Roman",
            fontSize: 16,
            color: titleHex,
            italic: true,
            valign: "top",
          });
        }
        break;
      }
    }
  });

  // Ghi tệp pptx tải xuống trình duyệt ngay lập tức
  const safeFilename = title_presentation.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "_") + ".pptx";

  pptx.writeFile({ fileName: safeFilename });
}
