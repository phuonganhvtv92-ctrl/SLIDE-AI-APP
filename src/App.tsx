/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Upload,
  FileText,
  Trash2,
  Plus,
  Play,
  Download,
  GraduationCap,
  LogIn,
  LogOut,
  FolderOpen,
  Eye,
  CheckCircle,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Palette,
  EyeOff,
  MoreVertical,
  PlusCircle,
  Check,
  Edit,
  Sliders,
  Calendar,
  Layers,
  Presentation as PresentationIcon,
  AlertCircle,
  ImageOff,
  Camera,
  Globe,
  Wand2,
  Compass,
  Undo,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  db,
  auth,
  googleProvider,
  isFirebaseConfigured,
  handleFirestoreError,
  OperationType
} from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { SlideData, THEME_PRESETS, ThemePreset, SlideLayout, VisualAid } from "./types";
import { exportToPowerPoint } from "./utils/pptxExport";
import { normalizeVietnameseText } from "./utils/textUtils";

// Biểu tượng động của Lucide tương quan với các Slide Icon gợi ý từ AI
const renderIcon = (iconName: string) => {
  const lower = iconName.toLowerCase();
  switch (lower) {
    case "presentation": return <PresentationIcon className="w-8 h-8" />;
    case "bookopen": return <FileText className="w-8 h-8" />;
    case "clock": return <span className="text-3xl font-bold">⏱️</span>;
    case "graduationcap": return <GraduationCap className="w-8 h-8" />;
    case "award": return <span className="text-3xl">🏆</span>;
    case "target": return <span className="text-3xl">🎯</span>;
    case "lightbulb": return <span className="text-3xl text-amber-400">💡</span>;
    case "shield": return <span className="text-3xl text-blue-400">🛡️</span>;
    case "settings": return <span className="text-3xl">⚙️</span>;
    case "globe": return <span className="text-3xl text-emerald-400">🌐</span>;
    case "chart":
    case "barchart": return <span className="text-3xl">📊</span>;
    case "checkcircle": return <CheckCircle className="w-8 h-8 text-emerald-500" />;
    case "users": return <span className="text-3xl">👥</span>;
    case "alertcircle":
    case "alerttriangle": return <AlertCircle className="w-8 h-8 text-rose-500" />;
    default: return <Sparkles className="w-8 h-8 text-amber-500" />;
  }
};

export default function App() {
  // --- STATE QUẢN LÝ TÀI KHOẢN ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string>("anonymous_lecturer");

  // --- HỆ THỐNG THÔNG BÁO TOAST CAO CẤP ---
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const toast = {
    success: (msg: string) => {
      setToastMessage(msg);
      setToastType("success");
      setTimeout(() => setToastMessage(null), 3000);
    },
    error: (msg: string) => {
      setToastMessage(msg);
      setToastType("error");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // --- STATE TÀI LIỆU UPLOAD & PROMPT ---
  const [file, setFile] = useState<{ name: string; base64: string; mimeType: string } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generationPreset, setGenerationPreset] = useState("mặc định");

  // --- STATE SLIDES & BÀI THUYẾT TRÌNH ---
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [presentationTitle, setPresentationTitle] = useState("Bài giảng không tên");
  const [selectedTheme, setSelectedTheme] = useState<ThemePreset>(THEME_PRESETS[0]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // --- THÔNG SỐ CONFIG TÙY BIẾN CHO SLIDE ---
  const [slideCountMode, setSlideCountMode] = useState<string>("10");
  const [customSlideCount, setCustomSlideCount] = useState<string>("12");
  const [presentationStyle, setPresentationStyle] = useState<string>("academic");
  const [selectedImageOption, setSelectedImageOption] = useState<string>("smart");

  // --- HỆ THỐNG LỊCH SỬ VÀ THÙNG RÁC ---
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [trashList, setTrashList] = useState<any[]>([]);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<any | null>(null);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);

  // --- STATE QUY TRÌNH & ĐIỀU KHIỂN ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isEditingSlide, setIsEditingSlide] = useState(false);
  const [activeTab, setActiveTab] = useState<"visual" | "outline">("visual");

  // Đóng mở bảng điều khiển lịch sử trên thiết bị di động
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- TỰ ĐỘNG KHỞI TẠO TÀI KHOẢN FIREBASE HOẶC LOCAL ---
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setCurrentUser(user);
          setUserId(user.uid);
        } else {
          setCurrentUser(null);
          setUserId("anonymous_lecturer");
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // --- ĐỒNG BỘ LỊCH SỬ ĐÃ TẠO (FIREBASE / LOCAL STORAGE) ---
  useEffect(() => {
    if (isFirebaseConfigured && db && userId !== "anonymous_lecturer") {
      // Đăng ký rà soát thời gian thực từ Firestore
      const path = "presentations";
      try {
        const q = query(
          collection(db, path),
          where("userId", "==", userId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const list: any[] = [];
          snapshot.forEach((doc) => {
            list.push({ docId: doc.id, ...doc.data() });
          });
          // Sắp xếp theo ngày tạo mới nhất
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setHistoryList(list);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        });
        return () => unsubscribe();
      } catch (err) {
        console.error("Lỗi đăng ký lắng nghe Firestore lịch sử:", err);
      }
    } else {
      // Đọc từ LocalStorage thô
      const localData = localStorage.getItem("ai_slides_history");
      if (localData) {
        try {
          setHistoryList(JSON.parse(localData));
        } catch (e) {
          console.error("Lỗi nạp lịch sử Local:", e);
        }
      }
    }
  }, [userId]);

  // --- TẢI THÙNG RÁC BÀI SOẠN TỪ LOCALSTORAGE ---
  useEffect(() => {
    const rawTrash = localStorage.getItem("ai_slides_trash");
    if (rawTrash) {
      try {
        setTrashList(JSON.parse(rawTrash));
      } catch (e) {
        console.error("Lỗi nạp danh sách thùng rác:", e);
      }
    }
  }, []);

  // --- ĐỀ CƯƠNG GỢI Ý ĐỂ THẦY CÔ CHỌN NHANH ---
  const PRESET_TOPICS = [
    { title: "Cách mạng công nghiệp 4.0", prompt: "Tạo slide giảng dạy chuyên sâu về cách mạng công nghiệp 4.0, tác động đến giáo dục và chuyển đổi số." },
    { title: "Phương pháp giảng dạy thông minh", prompt: "Bản slide giới thiệu về các phương pháp giảng dạy tích cực, thuyết kiến thiết (constructivism) áp dụng lớp học thông minh." },
    { title: "Kỹ năng nghiên cứu khoa học", prompt: "Các bước thực hiện một đề tài nghiên cứu khoa học cho sinh viên đại học, từ đặt câu hỏi đến viết báo cáo." }
  ];

  // --- XỬ LÝ KHÁM PHÁ FILE UP VỚI DRAG & DROP ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Đọc file sang Base64 chuẩn sư phạm để đẩy lên server
  const processSelectedFile = async (rawFile: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(rawFile);
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1] || "";
      setFile({
        name: rawFile.name,
        base64: base64String,
        mimeType: rawFile.type || "application/octet-stream"
      });
    };
    reader.onerror = (error) => {
      console.error("Lỗi nạp file:", error);
    };
  };

  // --- HÀM LOGIN / LOGOUT GOOGLE AUTH ---
  const handleLogin = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      alert("Firebase đang trong quá trình khởi tạo hoặc chưa được điền thông tin xác thực. Vui lòng thử lại hoặc sử dụng ngoại tuyến.");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Lỗi xác thực người dùng Google:", err);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Lỗi đăng xuất:", err);
    }
  };

  // --- CHỌN BẢN TRÌNH CHIẾU TỪ LỊCH SỬ ĐÃ LƯU ---
  const loadHistoryItem = (item: any) => {
    try {
      const parsedSlides = JSON.parse(item.slidesJson);
      setSlides(parsedSlides);
      setPresentationTitle(item.title);
      // Áp dụng lại theme preset tương quan
      const matchedTheme = THEME_PRESETS.find(t => t.id === item.themePreset) || THEME_PRESETS[0];
      setSelectedTheme(matchedTheme);
      setActiveSlideIndex(0);
      setSidebarOpen(false);
    } catch (e) {
      alert("Lỗi khi khôi phục bản slide từ cơ sở dữ liệu lịch sử.");
    }
  };

  // --- CHUẨN BỊ XÓA BÀI SOẠN (MỞ POPUP POPUP) ---
  const deleteHistoryItem = (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    setDeleteConfirmItem(item);
  };

  // --- XÁC NHẬN XÓA BẢN TRÌNH CHIẾU THỰC SỰ ---
  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeletingHistory(true);

    try {
      const item = deleteConfirmItem;
      const deletedAt = new Date().toISOString();

      // Sao lưu vào Thùng rác (Client-side)
      const freshTrash = [...trashList, { ...item, deletedAt, deleted: true }];
      setTrashList(freshTrash);
      localStorage.setItem("ai_slides_trash", JSON.stringify(freshTrash));

      // Thực thi xóa khỏi database/local
      if (isFirebaseConfigured && db && userId !== "anonymous_lecturer") {
        const path = "presentations";
        await deleteDoc(doc(db, path, item.docId));
      } else {
        const updated = historyList.filter(x => x.id !== item.id);
        setHistoryList(updated);
        localStorage.setItem("ai_slides_history", JSON.stringify(updated));
      }

      toast.success("Đã xóa bài soạn thành công");
      setDeleteConfirmItem(null);
    } catch (error: any) {
      toast.error("Không thể xóa bài soạn");
      console.error("Lỗi xóa bài soạn: ", error);
    } finally {
      setIsDeletingHistory(false);
    }
  };

  // --- KHÔI PHỤC BÀI SOẠN TỪ THÙNG RÁC ---
  const handleRestoreTrashItem = async (item: any) => {
    try {
      // 1. Phục hồi về Local hoặc Firebase
      if (isFirebaseConfigured && db && userId !== "anonymous_lecturer") {
        const path = "presentations";
        const restoredRecord = {
          id: item.id || item.docId,
          userId: userId,
          title: item.title,
          themePreset: item.themePreset,
          createdAt: item.createdAt || new Date().toISOString(),
          slidesJson: item.slidesJson
        };
        await setDoc(doc(db, path, item.id || item.docId), restoredRecord);
      } else {
        const { deleted, deletedAt, ...cleanedItem } = item;
        const freshHistory = [cleanedItem, ...historyList];
        setHistoryList(freshHistory);
        localStorage.setItem("ai_slides_history", JSON.stringify(freshHistory));
      }

      // 2. Xóa khỏi danh sách Thùng rác
      const updatedTrash = trashList.filter(x => x.id !== item.id && x.docId !== item.docId);
      setTrashList(updatedTrash);
      localStorage.setItem("ai_slides_trash", JSON.stringify(updatedTrash));

      toast.success("Khôi phục bài soạn thành công!");
    } catch (error: any) {
      toast.error("Không thể khôi phục bài soạn");
      console.error("Lỗi phục hồi: ", error);
    }
  };

  // --- XÓA VĨNH VIỄN CỦA THÙNG RÁC ---
  const handleHardDeleteTrashItem = (item: any) => {
    const confirmHard = window.confirm(
      `Bạn có chắc chắn muốn xóa vĩnh viễn bài giảng "${item.title}" không?\nHành động này sẽ không thể hoàn tác.`
    );
    if (!confirmHard) return;

    try {
      const updatedTrash = trashList.filter(x => x.id !== item.id && x.docId !== item.docId);
      setTrashList(updatedTrash);
      localStorage.setItem("ai_slides_trash", JSON.stringify(updatedTrash));
      toast.success("Đã xóa vĩnh viễn bài soạn.");
    } catch (error: any) {
      toast.error("Không thể xóa vĩnh viễn");
      console.error("Lỗi xóa vĩnh viễn: ", error);
    }
  };

  // --- GỌI API GEMINI ĐỂ SINH SLIDE ---
  const handleGenerateSlides = async () => {
    if (!file && !customPrompt.trim()) {
      alert("Vui lòng tải lên tài liệu học thuật (Word, PDF, hình ảnh) hoặc điền yêu cầu tóm tắt bài giảng trước khi khởi chạy!");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("Đang tiến hành đọc tài liệu và phân tích cấu trúc chủ đề...");
    
    // Một số thông điệp động tinh nghịch và học thuật giúp cải thiện trải nghiệm người dùng
    const loadingTexts = [
      "Gemini đang tiến hành lọc từ khóa học thuật chính trong tài liệu...",
      "Đang chia nhỏ bố cục slide sư phạm chuẩn (Times New Roman)...",
      "Đóng gói dữ liệu và tự động chọn lọc thiết bị trực quan phù hợp...",
      "Đang tối ưu dung lượng chữ và khoảng cách dòng bài giảng..."
    ];

    let textLoopIndex = 0;
    const textInterval = setInterval(() => {
      if (textLoopIndex < loadingTexts.length) {
        setStatusMessage(loadingTexts[textLoopIndex] || "");
        textLoopIndex++;
      }
    }, 3500);

    const finalSlideCount = slideCountMode === "custom" ? parseInt(customSlideCount, 10) || 12 : parseInt(slideCountMode, 10);

   try {
  // Gọi hàm callGemini từ file geminiApi.ts đã tạo
  const resultText = await callGemini(`Hãy tạo nội dung slide cho chủ đề: ${customPrompt}. Phong cách: ${presentationStyle}.`);

  // Xử lý để lấy ra dữ liệu JSON thuần túy
  const cleanJson = resultText.replace(/```json/g, "").replace(/```/g, "");
  const slideContent = JSON.parse(cleanJson);

  // Cập nhật kết quả vào ứng dụng
  setSlides(slideContent);
} catch (error) {
  console.error("Lỗi khi tạo slide:", error);
  alert("Có lỗi xảy ra khi tạo slide, hãy kiểm tra lại kết nối hoặc API Key.");
}
  const data = await response.json();
  // Lấy text trả về từ Gemini
  const text = data.candidates[0].content.parts[0].text;
  // Parse dữ liệu thành JSON để ứng dụng sử dụng
  const slideContent = JSON.parse(text.replace(/```json/g, "").replace(/```/g, ""));
  
  // Tiếp tục logic xử lý slideContent của bạn ở đây...

      clearInterval(textInterval);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gặp sự cố giải thuật AI trên máy chủ.");
      }

      const responseData = await res.json();
      
      if (!responseData.slides || responseData.slides.length === 0) {
        throw new Error("Mô hình AI trả về cấu trúc rỗng. Vui lòng bấm thử lại.");
      }

      const generatedSlides: SlideData[] = responseData.slides.map((slide: any) => ({
        ...slide,
        title: normalizeVietnameseText(slide.title || ""),
        content: Array.isArray(slide.content) ? slide.content.map((text: string) => normalizeVietnameseText(text || "")) : [],
        visualAid: slide.visualAid ? {
          ...slide.visualAid,
          description: normalizeVietnameseText(slide.visualAid.description || ""),
          header: slide.visualAid.header ? normalizeVietnameseText(slide.visualAid.header) : undefined,
          statLabel: slide.visualAid.statLabel ? normalizeVietnameseText(slide.visualAid.statLabel) : undefined,
        } : undefined
      }));
      setSlides(generatedSlides);
      setActiveSlideIndex(0);

      // Thử tìm tiêu đề của slide đầu tiên làm tiêu đề chính của bài giảng
      const docTitle = generatedSlides[0]?.title || "Bài giảng tóm tắt bài học";
      setPresentationTitle(docTitle);

      // Tự động ghi lại lịch sử bản thuyết trình mới sinh ra
      const newId = "deck_" + Date.now();
      const newRecord = {
        id: newId,
        userId: userId,
        title: docTitle,
        themePreset: selectedTheme.id,
        createdAt: new Date().toISOString(),
        slidesJson: JSON.stringify(generatedSlides)
      };

      if (isFirebaseConfigured && db && userId !== "anonymous_lecturer") {
        const path = "presentations";
        try {
          await setDoc(doc(db, path, newId), newRecord);
          console.log("[FIREBASE] Đã đồng bộ slide mới lên máy chủ.");
        } catch (fErr) {
          handleFirestoreError(fErr, OperationType.CREATE, `${path}/${newId}`);
        }
      } else {
        // Lưu trữ Local thô
        const currentSaved = localStorage.getItem("ai_slides_history");
        let list: any[] = [];
        if (currentSaved) {
          try {
            list = JSON.parse(currentSaved);
          } catch (_) {}
        }
        list.unshift(newRecord);
        localStorage.setItem("ai_slides_history", JSON.stringify(list));
        setHistoryList(list);
      }

    } catch (err: any) {
      console.error(err);
      alert("Đã xảy ra lỗi trong quá trình phân tích: " + err.message);
    } finally {
      clearInterval(textInterval);
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  // --- TRÌNH CHỈNH SỬA / CẬP NHẬT SLIDE THỦ CÔNG ---
  const handleUpdateActiveSlide = (updatedSlide: SlideData) => {
    const updatedDecks = [...slides];
    updatedDecks[activeSlideIndex] = updatedSlide;
    setSlides(updatedDecks);

    // Lưu lại trạng thái chỉnh sửa tức thì vào Cơ sở dữ liệu và Lịch sử
    const matchedRecord = historyList[0]; // Cập nhật bản ghi hiện tại
    if (matchedRecord) {
      const presentationId = matchedRecord.id || matchedRecord.docId;
      const updatedRecord = {
        id: presentationId,
        userId: userId,
        title: presentationTitle,
        themePreset: selectedTheme.id,
        createdAt: matchedRecord.createdAt || new Date().toISOString(),
        slidesJson: JSON.stringify(updatedDecks)
      };

      if (isFirebaseConfigured && db && userId !== "anonymous_lecturer") {
        const path = "presentations";
        try {
          setDoc(doc(db, path, presentationId), updatedRecord, { merge: true });
        } catch (fErr) {
          handleFirestoreError(fErr, OperationType.UPDATE, `${path}/${presentationId}`);
        }
      } else {
        const updatedLocal = historyList.map(item => {
          if (item.id === presentationId) {
            return { ...item, ...updatedRecord };
          }
          return item;
        });
        localStorage.setItem("ai_slides_history", JSON.stringify(updatedLocal));
        setHistoryList(updatedLocal);
      }
    }
  };

  // --- THÊM SLIDE MỚI / XOÁ SLIDE ---
  const handleAddNewSlide = () => {
    const newSlide: SlideData = {
      title: "Slide mới khởi tạo",
      content: ["Bấm nút chỉnh sửa để sửa đổi từng dòng gạch đầu dòng.", "Thêm nội dung súc tích nhất ở đây."],
      layout: "points",
      visualAid: {
        type: "icon",
        icon: "Presentation",
        description: "Hình họa gợi ý về trình chiếu và sư phạm."
      }
    };
    const updated = [...slides];
    // Chèn vào ngay sau vị trí hiện tại
    updated.splice(activeSlideIndex + 1, 0, newSlide);
    setSlides(updated);
    setActiveSlideIndex(activeSlideIndex + 1);
  };

  const deleteSlideFromDB = async (idxToDelete: number) => {
    const updated = slides.filter((_, idx) => idx !== idxToDelete);
    const matchedRecord = historyList[0]; // Cập nhật bản ghi hiện tại
    if (matchedRecord) {
      const presentationId = matchedRecord.id || matchedRecord.docId;
      const updatedRecord = {
        id: presentationId,
        userId: userId,
        title: presentationTitle,
        themePreset: selectedTheme.id,
        createdAt: matchedRecord.createdAt || new Date().toISOString(),
        slidesJson: JSON.stringify(updated)
      };

      if (isFirebaseConfigured && db && userId !== "anonymous_lecturer") {
        const path = "presentations";
        await setDoc(doc(db, path, presentationId), updatedRecord, { merge: true });
        console.log("[FIREBASE] Đã đồng bộ việc xóa slide lên máy chủ.");
      } else {
        const updatedLocal = historyList.map(item => {
          if (item.id === presentationId) {
            return { ...item, ...updatedRecord };
          }
          return item;
        });
        localStorage.setItem("ai_slides_history", JSON.stringify(updatedLocal));
        setHistoryList(updatedLocal);
      }
    }
  };

  const handleDeleteSlide = async (id: number | string) => {
    if (slides.length <= 1) {
      alert("Bài trình chiếu phải có tối thiểu 1 Slide.");
      return;
    }
    if (!confirm("Bạn có chắc chắn muốn xóa Slide này không?")) return;

    try {
      // Xác định chỉ số của slide cần xoá
      let idxToDelete: number;
      if (typeof id === "number") {
        idxToDelete = id;
      } else {
        // Tìm slide theo trường id (nếu có)
        idxToDelete = slides.findIndex((slide: any) => slide.id === id);
        if (idxToDelete === -1) {
          throw new Error("Không tìm thấy slide có ID được yêu cầu");
        }
      }

      // 1. Phác hoạ danh sách slide mới (Xóa local state)
      const updated = slides.filter((_, idx) => idx !== idxToDelete);
      setSlides(updated);
      
      if (activeSlideIndex >= updated.length) {
        setActiveSlideIndex(updated.length - 1);
      }

      // 2. Xóa database nếu có thông qua hàm con
      await deleteSlideFromDB(idxToDelete);

      // Hiển thị toast chúc mừng thành công rực rỡ
      toast.success("Đã xóa slide thành công!");
    } catch (error: any) {
      toast.error("Không thể xóa slide");
      console.error(error);
    }
  };

  // --- DI CHUYỂN SLIDE LÊN XUỐNG ---
  const handleMoveSlide = (currIndex: number, direction: "up" | "down") => {
    if (direction === "up" && currIndex === 0) return;
    if (direction === "down" && currIndex === slides.length - 1) return;

    const targetIdx = direction === "up" ? currIndex - 1 : currIndex + 1;
    const updated = [...slides];
    const temp = updated[currIndex];
    if (temp) {
      updated[currIndex] = updated[targetIdx] as SlideData;
      updated[targetIdx] = temp;
      setSlides(updated);
      setActiveSlideIndex(targetIdx);
    }
  };

  // --- XUẤT POWERPOINT (.pptx) ---
  const handleExport = () => {
    if (slides.length === 0) {
      alert("Vui lòng khởi tạo Slide bài giảng bằng AI trước khi tải xuống!");
      return;
    }
    // Thực thi xuất trực tiếp slide từ client bằng file pptxgenjs
    exportToPowerPoint(slides, selectedTheme, presentationTitle);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 font-sans text-zinc-100" id="powerpoint_app">
      {/* HEADER BANNER CHÍNH - PHONG CÁCH SƯ PHẠM CAO CẤP */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-30" id="main_header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20" id="logo_container">
            <GraduationCap className="w-6 h-6 text-zinc-950" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              Giảng Viên AI <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">PPTX PRO</span>
            </h1>
            <p className="text-xs text-zinc-400">Thiết kế bài giảng thông minh & Xuất bản PowerPoint chuyên nghiệp</p>
          </div>
        </div>

        {/* GOOGLE SOCIAL AUTH & STATUS BAGE */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs border border-zinc-800 bg-zinc-900 px-3 py-1.5 rounded-lg text-zinc-400" id="db_status">
            <span className={`w-2 h-2 rounded-full ${isFirebaseConfigured ? "bg-emerald-500 animate-pulse" : "bg-yellow-500"}`} />
            {isFirebaseConfigured ? "Đồng bộ Firebase Cloud: Sẵn sàng" : "Chế độ lưu Offline: Sẵn sàng"}
          </div>

          {!currentUser ? (
            <button
              onClick={handleLogin}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
              id="login_btn"
              disabled={!isFirebaseConfigured}
              title={!isFirebaseConfigured ? "Firebase chưa được thiết lập" : "Đăng nhập Google Cloud"}
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập đồng bộ</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg" id="profile_box">
              {currentUser.photoURL && (
                <img
                  src={currentUser.photoURL}
                  referrerPolicy="no-referrer"
                  alt="avatar"
                  className="w-6 h-6 rounded-full border border-zinc-700"
                />
              )}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-white truncate max-w-28">{currentUser.displayName}</p>
                <p className="text-[10px] text-zinc-400">Giảng viên đại học</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Đăng xuất tài khoản"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          )}

          {/* Nút bật tắt Lịch sử trên mobile */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400"
            id="mobile_sidebar_trigger"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* CORE FRAMEWORK WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative" id="core_workspace">
        
        {/* MOBILE SIDEBAR DRAWERS FOR LIBRARY HISTORY */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed inset-0 bg-zinc-950/90 z-40 md:hidden flex flex-col p-6 w-[80%] max-w-sm border-r border-zinc-800"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white flex items-center gap-2"><FolderOpen className="w-5 h-5" /> Kho Bài Giảng</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTrashOpen(true);
                      setSidebarOpen(false);
                    }}
                    className="text-[10px] uppercase font-semibold text-zinc-500 hover:text-rose-500 flex items-center gap-1 bg-zinc-900 border border-zinc-805 px-2 py-0.5 rounded cursor-pointer transition-all hover:bg-zinc-850"
                    title="Thùng rác"
                  >
                    <Trash2 className="w-3 h-3 text-zinc-500" />
                    ({trashList.length})
                  </button>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-zinc-500 hover:text-white font-bold text-sm">✕</button>
              </div>
              <HistorySidebarPanel
                historyList={historyList}
                loadHistoryItem={loadHistoryItem}
                deleteHistoryItem={deleteHistoryItem}
                currentUserId={userId}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* LEFT PANEL: INPUT CONTROL AREA (TÀI LIỆU, CHỦ ĐỀ, CHỌN NHANH) */}
        <aside className="w-full md:w-[380px] border-r border-zinc-800 bg-zinc-900/10 flex flex-col overflow-y-auto shrink-0 p-5 gap-6 scrollbar" id="library_and_tools_aside">
          
          {/* ZONE 1: INPUT FILE UPLOAD (DRAG & DROP) */}
          <div className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-500" />
              Bước 1: Tải tệp tư liệu giảng dạy
            </h2>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                dragActive 
                  ? "border-amber-500 bg-amber-500/10 scale-[0.98]" 
                  : file 
                    ? "border-emerald-500/60 bg-emerald-500/5 hover:border-emerald-500" 
                    : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/40"
              }`}
              onClick={() => document.getElementById("file-input-id")?.click()}
              id="drop_zone"
            >
              <input
                id="file-input-id"
                type="file"
                className="hidden"
                accept=".txt,.pdf,.docx,image/*"
                onChange={handleFileChange}
              />
              {file ? (
                <>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-zinc-100 truncate max-w-[260px]">{file.name}</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">Đã tệp lên thành công</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 text-zinc-400 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-zinc-300">Nhấn để chọn tệp hoặc kéo thả</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Hỗ trợ PDF, Word (.docx), TXT hoặc Hình ảnh giáo trình</p>
                  </div>
                </>
              )}
            </div>
            {file && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="text-[11px] self-end text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              >
                Gỡ bỏ tệp
              </button>
            )}
          </div>

          {/* ZONE 2: CHỌN NHANH CHỦ ĐỀ GỢI Ý */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Ý tưởng phác thảo giảng dạy nhanh</span>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_TOPICS.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => setCustomPrompt(topic.prompt)}
                  className="text-left text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 p-2.5 rounded-lg text-zinc-300 transition-all flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{topic.title}</span>
                  <Sparkles className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-500 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* ZONE 2.5: CẤU HÌNH SLIDE NÂNG CAO */}
          <div className="flex flex-col gap-4 border border-zinc-800 bg-zinc-950/45 p-4 rounded-xl text-left" id="slide_customization_controls">
            <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Sliders className="w-3.5 h-3.5" />
              Thiết kế cấu trúc Slide
            </h3>

            {/* 1. Chọn số lượng slide */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-medium text-zinc-400">Số trang slide cần tạo:</label>
              <div className="grid grid-cols-5 gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800/80">
                {["5", "10", "15", "20", "custom"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSlideCountMode(mode)}
                    className={`py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                      slideCountMode === mode
                        ? "bg-amber-500 text-zinc-950 font-bold"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {mode === "custom" ? "Tự chọn" : `${mode} Tr`}
                  </button>
                ))}
              </div>
              {slideCountMode === "custom" && (
                <div className="flex items-center justify-between gap-2 mt-1 px-1">
                  <span className="text-[10px] text-zinc-400">Số lượng slide yêu cầu:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={3}
                      max={40}
                      value={customSlideCount}
                      onChange={(e) => setCustomSlideCount(e.target.value)}
                      className="w-16 bg-zinc-950 text-center border border-zinc-805 rounded px-2 py-1 text-xs text-amber-400 outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="text-[10px] text-zinc-500">slides</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Chọn phong cách phong phú */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-medium text-zinc-400">Phong cách thuyết trình:</label>
              <div className="grid grid-cols-2 gap-1.5" id="presentation_style_grid">
                {[
                  { id: "academic", name: "Học thuật", desc: "Mô phạm, chuẩn mực" },
                  { id: "business", name: "Kinh doanh", desc: "Số liệu, kết quả" },
                  { id: "cinematic", name: "Điện ảnh", desc: "Kịch tính, cảm xúc" },
                  { id: "startup pitch", name: "Gọi vốn", desc: "Hấp dẫn, gọi vốn" },
                  { id: "minimal", name: "Tối giản", desc: "Tinh gọt, súc tích" },
                  { id: "modern", name: "Hiện đại", desc: "Đột phá, công nghệ" }
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setPresentationStyle(st.id)}
                    className={`p-2 rounded-lg border text-left transition-all flex flex-col gap-0.5 ${
                      presentationStyle === st.id
                        ? "bg-zinc-800/80 border-amber-500 text-white font-semibold"
                        : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span className="text-[11px] block">{st.name}</span>
                    <span className="text-[9px] text-zinc-500 block truncate">{st.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tự động áp dụng theme thiết kế nâng cao ngay từ Sidebar */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-zinc-400">Màu chủ đạo:</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:border-amber-500 outline-none"
                value={selectedTheme.id}
                onChange={(e) => {
                  const t = THEME_PRESETS.find((p) => p.id === e.target.value);
                  if (t) setSelectedTheme(t);
                }}
              >
                {THEME_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Thẩm mỹ trực quan: Hình ảnh cho Slide */}
            <div className="flex flex-col gap-2 border-t border-zinc-900 pt-3 mt-1">
              <label className="text-[11px] font-medium text-zinc-400">Hình ảnh cho slide:</label>
              <div className="grid grid-cols-2 gap-1.5" id="slide_image_option_grid">
                {[
                  { id: "smart", name: "AI tự chọn thông minh", desc: "Tối ưu hóa đa thế", icon: Compass },
                  { id: "none", name: "Không dùng hình ảnh", desc: "Tối giản bài học", icon: ImageOff },
                  { id: "realistic", name: "Ảnh thật", desc: "Phong cảnh & hiện vật thực", icon: Camera },
                  { id: "internet", name: "Ảnh lấy từ Internet", desc: "Tìm chuyên sâu qua web", icon: Globe },
                  { id: "ai_gen", name: "Ảnh do AI tạo", desc: "Đồ họa số sáng tạo", icon: Wand2 },
                  { id: "icon", name: "Icon minh họa", desc: "Súc tích bằng biểu tượng", icon: Layers }
                ].map((option) => {
                  const IconComponent = option.icon;
                  const isSelected = selectedImageOption === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedImageOption(option.id)}
                      className={`p-2 rounded-lg border text-left transition-all flex flex-col gap-0.5 relative group ${
                        isSelected
                          ? "bg-zinc-800/80 border-amber-500 text-white font-semibold"
                          : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                      title={`${option.name}: ${option.desc}`}
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-amber-500" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                        <span className="text-[10px] sm:text-[11px] block truncate font-medium">{option.name}</span>
                      </div>
                      <span className="text-[9px] text-zinc-500 block truncate mt-0.5">{option.desc}</span>
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ZONE 3: CUSTOM PROMPT INSTRUCTIONS */}
          <div className="flex flex-col gap-2.5">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Bước 2: Yêu cầu sư phạm (tùy chọn)
            </h2>
            <textarea
              className="w-full h-24 text-xs bg-zinc-900 border border-zinc-800 rounded-xl p-3 focus:border-amber-500 outline-none text-zinc-200 resize-none placeholder-zinc-600 font-sans leading-relaxed"
              placeholder="Ví dụ: Tạo 6 slide học thuyết triết học Mác, tập trung phân tích nguồn gốc xã hội, phong cách mộc mạc tối giản, chia rõ sơ đồ..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              id="custom_prompt_input"
            />
          </div>

          {/* ZONE 4: PRIMARY ACTION GENERATION BUTTON */}
          <button
            onClick={handleGenerateSlides}
            disabled={isGenerating}
            className={`w-full py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
              isGenerating
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                : "bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-amber-500/10 hover:shadow-amber-500/20"
            }`}
            id="generate_slides_btn"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-zinc-500 border-t-zinc-100 animate-spin" />
                <span>Đang xử lý luận văn...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI Thiết Kế Giáo Án Slide</span>
              </>
            )}
          </button>

          {/* TRẠNG THÁI KHỞI TẠO ĐỘNG HỌC */}
          {isGenerating && (
            <div className="p-3 bg-zinc-900/75 border border-zinc-800 rounded-xl flex items-start gap-2.5" id="status_toast">
              <Sliders className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-left">
                <p className="text-[11px] font-medium text-amber-400 uppercase tracking-widest animate-pulse">Đang nạp thuật toán</p>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{statusMessage}</p>
              </div>
            </div>
          )}

          {/* HORIZONTAL LINE SEPARATION */}
          <hr className="border-zinc-800" />

          {/* ZONE 5: KHO BÀI GIẢNG / LỊCH SỬ DESKTOP */}
          <div className="flex-1 flex flex-col gap-3 min-h-[180px] hidden md:flex" id="desktop_history_zone">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-zinc-500 tracking-wider flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5" />
                Kho bài soạn của bạn ({historyList.length})
              </h3>
              <button
                type="button"
                onClick={() => setIsTrashOpen(true)}
                className="text-[10px] uppercase font-semibold text-zinc-500 hover:text-rose-500 flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded cursor-pointer transition-all hover:bg-zinc-850"
                title="Thùng rác"
              >
                <Trash2 className="w-3 h-3 text-zinc-500 group-hover:text-rose-450" />
                Thùng rác ({trashList.length})
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1">
              <HistorySidebarPanel
                historyList={historyList}
                loadHistoryItem={loadHistoryItem}
                deleteHistoryItem={deleteHistoryItem}
                currentUserId={userId}
              />
            </div>
          </div>

        </aside>

        {/* MAIN PANEL: PREVIEW FRAME & WORKSPACE CANVAS */}
        <main className="flex-1 bg-zinc-950 flex flex-col overflow-y-auto p-4 md:p-6 gap-6" id="right_preview_main">
          
          {slides.length === 0 ? (
            // --- TRẠNG THÁI CHỜ BAN ĐẦU - GIỚI THIỆU SƯ PHẠM ---
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center py-12 gap-8" id="empty_workspace">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center animate-bounce">
                <Sparkles className="w-8 h-8 text-amber-500" />
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-2xl font-bold font-sans tracking-tight text-white">Chưa khởi tạo slide trình chiếu!</h2>
                <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
                  Hãy tải tài liệu Word thuyết trình khóa luận, giáo trình PDF hay viết yêu cầu bài giảng ở bảng bên trái. Hệ thống AI sư phạm thông minh sẽ lo phần phân tích chương, tóm lược và chia bố cục, vẽ slide với kiểu dáng chữ Times New Roman mô phạm lý tưởng.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 text-center">
                  <div className="text-lg font-bold text-amber-500 font-mono">28pt</div>
                  <div className="text-xs text-white font-medium mt-1">Cỡ chữ lớn tối ưu</div>
                  <div className="text-[10px] text-zinc-500 mt-1">Không nhồi chữ thưa thoáng, giúp sinh viên nắm vững ý cốt lõi</div>
                </div>
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 text-center">
                  <div className="text-lg font-bold text-amber-500 font-mono">16:9</div>
                  <div className="text-xs text-white font-medium mt-1">Bố cục màn ảnh rộng</div>
                  <div className="text-[10px] text-zinc-500 mt-1">Tỷ lệ tương thích 100% với tivi giảng đường thế hệ mới</div>
                </div>
                <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 text-center">
                  <div className="text-lg font-bold text-emerald-500 font-mono">.pptx</div>
                  <div className="text-xs text-white font-medium mt-1">PowerPoint Thực Tế</div>
                  <div className="text-[10px] text-zinc-500 mt-1">Tải trực tiếp về máy, mở chỉnh sửa trên MS Office nguyên lề</div>
                </div>
              </div>
            </div>
          ) : (
            // --- WORKSPACE CHÍNH (ĐÃ CÓ SLIDES TRÌNH CHIẾU) ---
            <div className="flex-1 flex flex-col gap-6" id="active_workspace">
              
              {/* TOP BAR: TIÊU ĐỀ BÀI THUYẾT TRÌNH VÀ THANH XUẤT FILE */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-900 p-4 rounded-xl" id="top_presentation_control_bar">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Layers className="w-5 h-5 text-amber-500 shrink-0" />
                  <input
                    type="text"
                    value={presentationTitle}
                    onChange={(e) => setPresentationTitle(e.target.value)}
                    className="text-base font-semibold bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-amber-500 outline-none text-white w-full sm:w-[320px] pb-1"
                    title="Bấm để đổi tên bài giảng"
                  />
                </div>
                
                {/* LỰA CHỌN PRESET THEME TỐI GIẢN CHẤT LƯỢNG CAO */}
                <div className="flex flex-wrap items-center gap-2" id="preset_theme_selector">
                  <span className="text-xs text-zinc-400 font-medium flex items-center gap-1.5"><Palette className="w-3.5 h-3.5 text-zinc-500" /> Bảng màu:</span>
                  <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    {THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedTheme(preset)}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                          selectedTheme.id === preset.id
                            ? "bg-amber-500 text-zinc-950"
                            : "text-zinc-400 hover:text-white"
                        }`}
                        title={preset.description}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>

                  {/* NÚT TẢI XUỐNG POWERPOINT */}
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/10 transition-colors ml-2 cursor-pointer"
                    id="export_pptx_full_btn"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất file .PPTX</span>
                  </button>
                </div>
              </div>

              {/* CENTER COMPONENT: SLIDE TIMELINE THUMBNAIL TRACK (DÀI THỜI GIAN) + 16:9 PREVIEW FRAME */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start" id="timeline_and_canvas_grid">
                
                {/* CỘT TIMELINE SLIDE BÊN TRÁI (TRACK CHUYỂN SLIDE NHANH) */}
                <div className="lg:col-span-1 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto max-h-[140px] lg:max-h-[500px] pb-2 lg:pb-0 scrollbar pr-1" id="slide_deck_timeline">
                  {slides.map((slide, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setActiveSlideIndex(idx);
                        setIsEditingSlide(false);
                      }}
                      style={{
                        backgroundColor: idx === activeSlideIndex ? selectedTheme.backgroundColor : "#18181b",
                        backgroundImage: idx === activeSlideIndex && selectedTheme.gradient ? selectedTheme.gradient : undefined,
                        borderColor: idx === activeSlideIndex ? selectedTheme.accentColor : "#3f3f46"
                      }}
                      className={`flex-none lg:flex-initial w-[120px] lg:w-full p-2.5 rounded-lg border-2 text-left cursor-pointer transition-all aspect-video flex flex-col justify-between relative group`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-zinc-500 group-hover:text-amber-500 font-mono">
                          Slide {idx + 1}
                        </span>
                        
                        {/* HÀNH ĐỘNG KHỞI TẠO QUICK DELETE VÀ MOVE */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity absolute top-1.5 right-1.5 bg-zinc-950/80 p-0.5 rounded backdrop-blur">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteSlide(idx); }}
                            className="p-0.5 text-zinc-500 hover:text-rose-400"
                            title="Xóa Slide này"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-[10px] font-semibold truncate mt-1 w-full" style={{ color: idx === activeSlideIndex ? selectedTheme.titleColor : "#f4f4f5" }}>
                        {slide.title}
                      </p>
                      
                      <span className="text-[8px] font-mono px-1 rounded self-start mt-1" style={{ backgroundColor: selectedTheme.badgeBackgroundColor, color: selectedTheme.accentColor }}>
                        {slide.layout.toUpperCase()}
                      </span>
                    </div>
                  ))}

                  {/* NÚT THÊM SLIDE NHANH CHÓNG */}
                  <button
                    onClick={handleAddNewSlide}
                    className="flex-none lg:flex-initial w-[120px] lg:w-full border-2 border-dashed border-zinc-800 hover:border-zinc-500 hover:bg-zinc-900/40 rounded-lg p-3 transition-all aspect-video flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-200"
                    id="add_slide_timeline_btn"
                  >
                    <PlusCircle className="w-5 h-5" />
                    <span className="text-[10px] font-medium">Thêm slide mới</span>
                  </button>
                </div>

                {/* KHUNG CANVAS 16:9 PREVIEW TRÙNG PHONG CÁCH QUỐC TẾ */}
                <div className="lg:col-span-3 flex flex-col gap-4" id="presentation_canvas_area">
                  
                  {/* TAB SWITCHER: BIỂU DIỄN TRỰC QUAN / SƠ ĐỒ Ý ĐỀ CƯƠNG */}
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setActiveTab("visual"); setIsEditingSlide(false); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          activeTab === "visual" ? "bg-zinc-800 text-amber-500" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" /> Thuyết trình 16:9
                      </button>
                      <button
                        onClick={() => { setActiveTab("outline"); setIsEditingSlide(true); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          activeTab === "outline" ? "bg-zinc-800 text-amber-500" : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Edit className="w-3.5 h-3.5" /> Soạn thảo / Sửa đổi
                      </button>
                    </div>

                    {/* LƯỚT CHUYỂN SLIDE BẰNG NÚT BẤM */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400" id="slide_pager">
                      <button
                        disabled={activeSlideIndex === 0}
                        onClick={() => setActiveSlideIndex(activeSlideIndex - 1)}
                        className="p-1 px-2 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-[11px] text-zinc-300">
                        {activeSlideIndex + 1} / {slides.length}
                      </span>
                      <button
                        disabled={activeSlideIndex === slides.length - 1}
                        onClick={() => setActiveSlideIndex(activeSlideIndex + 1)}
                        className="p-1 px-2 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {activeTab === "visual" ? (
                    // --- 16:9 DŨNG MÃNH RENDER THEME PREVIEW ---
                    <div
                      className="slide-preview-container rounded-2xl p-8 md:p-12 border shadow-2xl relative overflow-hidden flex flex-col justify-between select-none transition-all duration-300 chalkboard-texture"
                      style={{
                        backgroundColor: selectedTheme.backgroundColor,
                        backgroundImage: selectedTheme.gradient || undefined,
                        borderColor: selectedTheme.borderColor,
                      }}
                      id="slide_canvas_container"
                    >
                      {/* Vạch biểu điểu sọc trên đầu slide mộc */}
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: selectedTheme.accentColor }} />

                      {slides[activeSlideIndex] ? (
                        <RenderActiveSlideVisual
                          slide={slides[activeSlideIndex] as SlideData}
                          theme={selectedTheme}
                        />
                      ) : (
                        <div className="text-center text-zinc-500 my-auto">Lỗi nạp slide dữ liệu</div>
                      )}

                      {/* Trạng thái Footer chân trang */}
                      <div className="flex items-center justify-between border-t pt-3 mt-4 text-[10px]" style={{ borderColor: selectedTheme.borderColor }}>
                        <span className="font-serif tracking-wider" style={{ color: selectedTheme.textColor }}>
                          {presentationTitle}
                        </span>
                        <span className="font-mono" style={{ color: selectedTheme.accentColor }}>
                          {slides[activeSlideIndex]?.layout.toUpperCase()} / PAGE {activeSlideIndex + 1}
                        </span>
                      </div>
                    </div>
                  ) : (
                    // --- CHẾ ĐỘ SỬA ĐỔI / QUẢN TRỊ BẢNG ĐỀ CƯƠNG ---
                    <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6" id="edit_workspace_form">
                      {slides[activeSlideIndex] ? (
                        <SlideOutlineEditorForm
                          slide={slides[activeSlideIndex] as SlideData}
                          onChange={handleUpdateActiveSlide}
                          onMove={(dir) => handleMoveSlide(activeSlideIndex, dir)}
                          onAddNew={handleAddNewSlide}
                          onDelete={() => handleDeleteSlide(activeSlideIndex)}
                          currentIndex={activeSlideIndex}
                          totalLength={slides.length}
                        />
                      ) : (
                        <p className="text-zinc-500 text-center py-12">Chưa có thông tin slide để biên tập</p>
                      )}
                    </div>
                  )}

                  {/* THANH PANEL BỔ TRỢ HÀNH VI: DI CHUYỂN, XOÁ, SẮP XẾP */}
                  <div className="bg-zinc-900/20 border border-zinc-900/60 p-3 px-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs" id="quick_slide_toolbar">
                    <span className="text-zinc-400 font-medium">Lối tắt chỉnh lý Slide:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMoveSlide(activeSlideIndex, "up")}
                        disabled={activeSlideIndex === 0}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-lg text-zinc-300 transition-colors cursor-pointer"
                      >
                        Đẩy Slide lên ↑
                      </button>
                      <button
                        onClick={() => handleMoveSlide(activeSlideIndex, "down")}
                        disabled={activeSlideIndex === slides.length - 1}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-800 rounded-lg text-zinc-300 transition-colors cursor-pointer"
                      >
                        Hạ Slide xuống ↓
                      </button>
                      <button
                        onClick={handleAddNewSlide}
                        className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-amber-400 transition-colors cursor-pointer"
                      >
                        + Chèn Slide mới
                      </button>
                      <button
                        onClick={() => handleDeleteSlide(activeSlideIndex)}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-rose-400 transition-colors cursor-pointer"
                      >
                        Xóa Slide tệp
                      </button>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

        </main>

      </div>

      {/* KHU VỰC POPUP XÁC NHẬN XÓA BÀI GIẢNG (CUSTOM DIALOG) */}
      <AnimatePresence>
        {deleteConfirmItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" id="delete_confirm_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-zinc-90 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-zinc-800 relative text-left bg-zinc-900"
              id="delete_confirm_modal"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-sm font-semibold text-white">Xác nhận xóa bài soạn</h4>
                  <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
                    Bạn có chắc muốn xóa bài soạn này?
                  </p>
                  <p className="text-[11px] text-rose-400 font-medium mt-1">
                    Hành động này không thể hoàn tác.
                  </p>
                  
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 mt-3.5 overflow-hidden">
                    <span className="text-[10px] text-zinc-500 font-mono block">Tên bài soạn:</span>
                    <p className="text-xs font-semibold text-zinc-250 truncate mt-1">{deleteConfirmItem.title}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-5 pt-3.5 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(null)}
                  disabled={isDeletingHistory}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-450 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeletingHistory}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingHistory ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5 animate-pulse" />
                      <span>Xác nhận xóa</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING POPUP DANH SÁCH THÙNG RÁC */}
      <AnimatePresence>
        {isTrashOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="trash_overlay">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-zinc-90 w-full max-w-md rounded-2xl p-5 shadow-2xl border border-zinc-800 flex flex-col max-h-[80vh] relative text-left bg-zinc-900"
              id="trash_modal"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-500 animate-pulse" />
                  <h4 className="text-sm font-semibold text-white">Thùng rác tạm thời ({trashList.length})</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTrashOpen(false)}
                  className="text-zinc-500 hover:text-white font-bold transition-colors w-7 h-7 flex items-center justify-center bg-zinc-950 border border-zinc-850 rounded-full text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-1" id="trash_list_scroller">
                {trashList.length === 0 ? (
                  <div className="text-center py-10">
                    <Trash2 className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
                    <p className="text-xs text-zinc-500 font-medium">Thùng rác cảm ơn bạn vì trống trơn!</p>
                    <span className="text-[10px] text-zinc-600 block mt-1">Các giáo trình bị xóa sẽ tạm thời có mặt ở đây</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {trashList.map((item, idx) => {
                      let numSlides = 0;
                      try {
                        numSlides = JSON.parse(item.slidesJson).length;
                      } catch (_) {}
                      
                      const deletedDate = item.deletedAt
                        ? new Date(item.deletedAt).toLocaleString("vi-VN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "Gần đây";

                      return (
                        <div
                          key={idx}
                          className="bg-zinc-950/40 border border-zinc-850 p-2.5 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 overflow-hidden text-left">
                            <p className="text-[11px] font-semibold text-zinc-200 truncate">{item.title}</p>
                            <div className="flex items-center gap-1.5 mt-1 text-[9px] text-zinc-500 font-mono">
                              <span className="bg-zinc-900 border border-zinc-800 px-1 py-0.25 rounded">
                                {numSlides} SLIDES
                              </span>
                              <span>•</span>
                              <span>{deletedDate}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRestoreTrashItem(item)}
                              className="p-1 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-450 hover:text-white border border-emerald-500/20 text-[10px] font-medium transition-all flex items-center gap-1 cursor-pointer"
                              title="Khôi phục lại bản soạn thảo học thuật"
                            >
                              <Undo className="w-2.5 h-2.5" />
                              <span>Khôi phục</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHardDeleteTrashItem(item)}
                              className="p-1 rounded hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 font-medium transition-colors cursor-pointer"
                              title="Xóa vĩnh viễn không khôi phục"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-3.5 pt-3 shadow-t border-t border-zinc-800 text-[10px] text-zinc-500 text-center font-mono">
                Lưu trữ tạm thời tại Trình duyệt cục bộ.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING TOAST NOTIFICATION BANNER */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 border"
            style={{
              backgroundColor: toastType === "success" ? "#064e3b" : "#7f1d1d",
              borderColor: toastType === "success" ? "#059669" : "#dc2626",
              color: "#ffffff"
            }}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              toastType === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
            }`}>
              {toastType === "success" ? "✓" : "!"}
            </div>
            <p className="text-sm font-medium pr-1">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// THÀNH PHẦN HOẠT HỌA PHÂN PHỐI SLIDE THEO LAYOUT DỰA TRÊN THEMEPRESET
// ==========================================
const renderSlideImage = (slide: SlideData, className: string = "w-full h-32 md:h-40 object-cover rounded-lg border border-zinc-700/30 shadow") => {
  if (!slide.imageUrl) return null;
  return (
    <div className="relative group overflow-hidden rounded-lg w-full flex justify-center">
      <img
        src={slide.imageUrl}
        alt={slide.title}
        className={className}
        referrerPolicy="no-referrer"
        onError={(e) => {
          // Automatic high quality fallback to Picsum Photos
          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${slide.imageKeywords || "education"}/640/480`;
        }}
      />
      {slide.imageKeywords && (
        <span className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-xs text-[9px] text-zinc-300 font-mono px-1.5 py-0.5 rounded uppercase tracking-wider">
          #{slide.imageKeywords}
        </span>
      )}
    </div>
  );
};

interface RenderActiveSlideVisualProps {
  slide: SlideData;
  theme: ThemePreset;
}
function RenderActiveSlideVisual({ slide, theme }: RenderActiveSlideVisualProps) {
  const layout = slide.layout;

  // Render kiểu Times New Roman cực sang trọng
  const titleStyle: React.CSSProperties = {
    color: theme.titleColor,
    fontFamily: "Times New Roman, Times, Georgia, serif",
    lineHeight: "1.2"
  };

  const bodyStyle: React.CSSProperties = {
    color: theme.textColor,
    fontFamily: "Times New Roman, Times, Georgia, serif",
    lineHeight: "1.6"
  };

  switch (layout) {
    case "title":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 my-auto" id="layout_title_render">
          {/* Mốc trang trí trên đầu của slide tiêu đề */}
          <div className="w-16 h-1 w-2/3 mx-auto" style={{ backgroundColor: theme.accentColor }} />
          
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight px-4 max-w-4xl" style={titleStyle}>
            {slide.title}
          </h2>
          
          <div className="flex flex-col gap-2 mt-2">
            {slide.content.map((elem, i) => (
              <p key={i} className="text-base md:text-xl font-medium tracking-wide italic" style={{ color: theme.accentColor }}>
                {elem}
              </p>
            ))}
          </div>

          {slide.imageUrl && (
            <div className="mt-2 w-full max-w-sm">
              {renderSlideImage(slide, "w-full h-32 md:h-36 object-cover rounded-xl border border-zinc-700/50 shadow-lg")}
            </div>
          )}
          
          <div className="mt-2 text-xs font-mono py-1 px-3 rounded-full" style={{ backgroundColor: theme.badgeBackgroundColor, color: theme.textColor }}>
            BÀI GIẢNG ĐẠI HỌC CHUYÊN SƠN
          </div>
        </div>
      );

    case "intro":
      return (
        <div className="flex-1 flex flex-col gap-6" id="layout_intro_render">
          {/* Tiêu đề góc trên */}
          <div className="flex flex-col gap-1.5" id="slide_header">
            <h3 className="text-2xl md:text-3xl font-bold" style={titleStyle}>
              {slide.title}
            </h3>
            <div className="w-16 h-1" style={{ backgroundColor: theme.accentColor }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start mt-2">
            {/* Cột trái: Ý chính hiển thị size 28 hứa hẹn */}
            <div className="md:col-span-3 flex flex-col gap-3">
              {slide.content.map((point, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span className="text-xl md:text-2xl mt-0.5" style={{ color: theme.accentColor }}>•</span>
                  <p className="text-base md:text-[23px] font-medium leading-relaxed" style={bodyStyle}>
                    {point}
                  </p>
                </div>
              ))}
            </div>

            {/* Cột phải: Khung giáo cụ trực quan */}
            {slide.visualAid ? (
              <div
                className="md:col-span-2 rounded-xl p-4 border flex flex-col gap-3 backdrop-blur"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.badgeBackgroundColor }}
                id="visual_card"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-950/40" style={{ color: theme.accentColor }}>
                    {renderIcon(slide.visualAid.icon)}
                  </div>
                  <span className="text-xs font-mono uppercase font-bold tracking-widest" style={{ color: theme.accentColor }}>
                    Hướng dẫn đồ họa
                  </span>
                </div>
                <hr style={{ borderColor: theme.borderColor }} />
                
                {renderSlideImage(slide, "w-full h-28 object-cover rounded-lg border border-zinc-700/20 shadow-xs")}

                <p className="text-xs italic leading-relaxed font-sans" style={{ color: theme.textColor }}>
                  {slide.visualAid.description}
                </p>
              </div>
            ) : (
              slide.imageUrl && (
                <div className="md:col-span-2 rounded-xl p-4 border" style={{ borderColor: theme.borderColor, backgroundColor: theme.badgeBackgroundColor }}>
                  {renderSlideImage(slide, "w-full h-44 object-cover rounded-lg border border-zinc-700/20")}
                </div>
              )
            )}
          </div>
        </div>
      );

    case "points":
      return (
        <div className="flex-1 flex flex-col gap-6" id="layout_points_render">
          {/* Tiêu đề phía trên */}
          <div className="flex flex-col gap-1.5" id="slide_header">
            <h3 className="text-2xl md:text-3xl font-bold" style={titleStyle}>
              {slide.title}
            </h3>
            <div className="w-16 h-1" style={{ backgroundColor: theme.accentColor }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start mt-2">
            {/* Gạch đầu dòng kích thước lớn đặc trưng (Cỡ 28) */}
            <div className="md:col-span-3 flex flex-col gap-4">
              {slide.content.map((point, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <span className="text-xl md:text-2xl mt-0.5" style={{ color: theme.accentColor }}>•</span>
                  <p className="text-base md:text-[24px] font-medium leading-relaxed" style={bodyStyle}>
                    {point}
                  </p>
                </div>
              ))}
            </div>

            {/* Khung minh họa gợi ý phía bên phải */}
            {slide.visualAid ? (
              <div
                className="md:col-span-2 rounded-xl p-5 border flex flex-col gap-3 text-center items-center justify-center py-6"
                style={{ borderColor: theme.borderColor, backgroundColor: theme.badgeBackgroundColor }}
                id="visual_illustration"
              >
                <div className="p-2.5 rounded-full bg-zinc-950/40" style={{ color: theme.accentColor }}>
                  {renderIcon(slide.visualAid.icon)}
                </div>
                <h4 className="text-[12px] font-semibold tracking-wider font-mono uppercase" style={{ color: theme.accentColor }}>
                  {slide.visualAid.icon.toUpperCase()} MINH HỌA
                </h4>
                
                {renderSlideImage(slide, "w-full h-28 object-cover rounded-lg border border-zinc-700/20")}

                <p className="text-xs text-center leading-relaxed italic font-sans" style={{ color: theme.textColor }}>
                  {slide.visualAid.description}
                </p>
              </div>
            ) : (
              slide.imageUrl && (
                <div className="md:col-span-2 rounded-xl p-4 border" style={{ borderColor: theme.borderColor, backgroundColor: theme.badgeBackgroundColor }}>
                  {renderSlideImage(slide, "w-full h-44 object-cover rounded-lg border border-zinc-700/20")}
                </div>
              )
            )}
          </div>
        </div>
      );

    case "two_column": {
      const mid = Math.ceil(slide.content.length / 2);
      const col1 = slide.content.slice(0, mid);
      const col2 = slide.content.slice(mid);

      return (
        <div className="flex-1 flex flex-col gap-6" id="layout_twocolumn_render">
          <div className="flex flex-col gap-1.5" id="slide_header">
            <h3 className="text-2xl md:text-3xl font-bold" style={titleStyle}>
              {slide.title}
            </h3>
            <div className="w-16 h-1" style={{ backgroundColor: theme.accentColor }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-2">
            {/* Cột 1 */}
            <div className="flex flex-col gap-3">
              {col1.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-xl md:text-2xl mt-0.5" style={{ color: theme.accentColor }}>•</span>
                  <p className="text-base md:text-[23px] font-medium leading-relaxed" style={bodyStyle}>
                    {item}
                  </p>
                </div>
              ))}
            </div>

            {/* Cột 2 */}
            <div className="flex flex-col gap-3">
              {col2.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-xl md:text-2xl mt-0.5" style={{ color: theme.accentColor }}>•</span>
                  <p className="text-base md:text-[23px] font-medium leading-relaxed" style={bodyStyle}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {slide.imageUrl && (
            <div className="mt-2 flex justify-center w-full">
              {renderSlideImage(slide, "w-full max-w-lg h-24 md:h-28 object-cover rounded-xl border border-zinc-700/30 shadow-xs")}
            </div>
          )}
        </div>
      );
    }

    case "quote":
      return (
        <div className="flex-1 flex flex-col justify-center items-center text-center py-4 px-4 my-auto relative" id="layout_quote_render">
          {/* Dấu trích dẫn khổng lồ mờ nhạt làm cảnh */}
          <div className="absolute top-0 left-6 text-7xl font-serif select-none pointer-events-none opacity-20" style={{ color: theme.accentColor }}>“</div>
          
          <h3 className="text-lg md:text-2xl font-bold tracking-wide italic mb-3" style={{ color: theme.accentColor }}>
            — {slide.title} —
          </h3>
          
          <div className="flex flex-col gap-3 max-w-3xl">
            {slide.content.map((text, i) => (
              <p
                key={i}
                className="text-lg md:text-[28px] font-medium italic leading-relaxed text-center font-serif"
                style={{ color: theme.titleColor }}
              >
                &ldquo;{text}&rdquo;
              </p>
            ))}
          </div>

          {slide.imageUrl && (
            <div className="mt-3 w-40">
              {renderSlideImage(slide, "w-40 h-20 md:h-24 object-cover rounded-xl border border-zinc-700/40 shadow-md")}
            </div>
          )}

          <div className="absolute bottom-0 right-6 text-7xl font-serif select-none pointer-events-none opacity-20" style={{ color: theme.accentColor }}>”</div>
        </div>
      );

    case "stats": {
      const statNum = slide.visualAid?.statNumber || "95%";
      const statLbl = slide.visualAid?.statLabel || "Chỉ số thuyết phục của bài học";

      return (
        <div className="flex-1 flex flex-col gap-6" id="layout_stats_render">
          <div className="flex flex-col gap-1.5" id="slide_header">
            <h3 className="text-2xl md:text-3xl font-bold" style={titleStyle}>
              {slide.title}
            </h3>
            <div className="w-16 h-1" style={{ backgroundColor: theme.accentColor }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mt-2">
            {/* Khối số liệu lớn */}
            <div className="flex flex-col items-center justify-center p-4 text-center">
              {slide.imageUrl && (
                <div className="mb-2 w-32">
                  {renderSlideImage(slide, "w-32 h-16 md:h-20 object-cover rounded-lg border border-zinc-700/30 shadow-xs")}
                </div>
              )}
              <span className="text-6xl md:text-7xl font-bold tracking-tight font-serif select-all" style={{ color: theme.accentColor }}>
                {statNum}
              </span>
              <p className="text-xs md:text-sm font-semibold mt-1 font-sans" style={{ color: theme.textColor }}>
                {statLbl}
              </p>
            </div>

            {/* Khối chi tiết văn bản */}
            <div className="flex flex-col gap-3">
              {slide.content.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-xl md:text-2xl mt-0.5" style={{ color: theme.accentColor }}>•</span>
                  <p className="text-base md:text-[23px] font-medium leading-relaxed text-left" style={bodyStyle}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "conclusion":
      return (
        <div className="flex-1 flex flex-col gap-6" id="layout_conclusion_render">
          <div className="flex flex-col gap-1.5" id="slide_header">
            <h3 className="text-2xl md:text-3xl font-bold uppercase" style={titleStyle}>
              {slide.title || "TỔNG KẾT BÀI HỌC"}
            </h3>
            <div className="w-16 h-1" style={{ backgroundColor: theme.accentColor }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start mt-2">
            {/* Danh sách ý chính tổng kết */}
            <div className="md:col-span-3 flex flex-col gap-3">
              {slide.content.map((point, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <CheckCircle className="w-5 h-5 mt-1 text-emerald-500 shrink-0" />
                  <p className="text-base md:text-[23px] font-medium leading-relaxed" style={bodyStyle}>
                    {point}
                  </p>
                </div>
              ))}
            </div>

            {/* Ô câu hỏi rèn luyện kỹ năng sinh viên */}
            <div
              className="md:col-span-2 rounded-xl p-4 border text-center flex flex-col gap-3 items-center"
              style={{ backgroundColor: theme.badgeBackgroundColor, borderColor: theme.borderColor }}
              id="self_study_card"
            >
              <div className="w-8 h-8 rounded-full bg-zinc-950/40 flex items-center justify-center text-amber-500 shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: theme.accentColor }}>
                Câu hỏi tư duy tự học
              </h4>
              
              {renderSlideImage(slide, "w-full h-24 object-cover rounded-lg border border-zinc-700/20")}

              <p className="text-xs italic leading-relaxed font-sans" style={{ color: theme.textColor }}>
                {slide.visualAid?.description || "Giảng viên gợi ý câu hỏi cốt lõi để sinh viên thảo luận nhóm và bồi dưỡng tư duy phản biện."}
              </p>
            </div>
          </div>
        </div>
      );

    case "divider":
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 my-auto" id="layout_divider_render">
          {/* Mốc trang trí chuyển tiếp chương */}
          <div className="flex items-center gap-4 w-full justify-center">
            <div className="h-0.5 w-16 bg-gradient-to-r from-transparent" style={{ backgroundColor: theme.accentColor }} />
            <span className="text-xs uppercase tracking-[0.2em] font-mono" style={{ color: theme.accentColor }}>CHƯƠNG PHÂN TÁCH</span>
            <div className="h-0.5 w-16 bg-gradient-to-l from-transparent" style={{ backgroundColor: theme.accentColor }} />
          </div>

          <h2 className="text-3xl md:text-5xl font-bold tracking-tight px-4 max-w-4xl" style={titleStyle}>
            {slide.title}
          </h2>

          <div className="flex flex-col gap-2.5 mt-4 max-w-2xl bg-zinc-950/20 p-4 rounded-xl border border-dashed" style={{ borderColor: theme.borderColor }}>
            {slide.content.map((elem, i) => (
              <p key={i} className="text-sm md:text-base font-medium leading-relaxed" style={{ color: theme.textColor }}>
                {elem}
              </p>
            ))}
          </div>

          {slide.imageUrl && (
            <div className="mt-2 w-full max-w-sm">
              {renderSlideImage(slide, "w-full h-32 md:h-36 object-cover rounded-xl border border-zinc-700/50 shadow-lg")}
            </div>
          )}
        </div>
      );

    case "summary":
      return (
        <div className="flex-1 flex flex-col gap-6" id="layout_summary_render">
          <div className="flex flex-col gap-1.5" id="slide_header">
            <span className="text-[10px] uppercase font-mono tracking-widest" style={{ color: theme.accentColor }}>TÓM TẮT ĐIỂM CHÍNH</span>
            <h3 className="text-2xl md:text-3xl font-bold" style={titleStyle}>
              {slide.title || "TỔNG KẾT & CHẮT LỌC KIẾN THỨC"}
            </h3>
            <div className="w-16 h-1" style={{ backgroundColor: theme.accentColor }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start mt-2">
            {/* Danh sách bento tóm tắt ý */}
            <div className="md:col-span-3 grid grid-cols-1 gap-2.5">
              {slide.content.map((point, index) => (
                <div key={index} className="flex gap-3 bg-zinc-950/30 p-3.5 rounded-xl border border-zinc-900" style={{ borderColor: theme.borderColor }}>
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-sm md:text-[18px] font-medium leading-relaxed text-left" style={bodyStyle}>
                    {point}
                  </p>
                </div>
              ))}
            </div>

            {/* Cột minh họa bên phải */}
            {slide.imageUrl ? (
              <div className="md:col-span-2 rounded-xl p-4 border flex flex-col gap-3 justify-center items-center h-full" style={{ borderColor: theme.borderColor, backgroundColor: theme.badgeBackgroundColor }}>
                {renderSlideImage(slide, "w-full h-36 object-cover rounded-lg border border-zinc-700/20 shadow")}
                <span className="text-[10px] italic font-sans text-center block" style={{ color: theme.textColor }}>
                  Hình ảnh trực quan tổng thể
                </span>
              </div>
            ) : (
              slide.visualAid && (
                <div className="md:col-span-2 rounded-xl p-5 border flex flex-col gap-3 justify-center items-center" style={{ borderColor: theme.borderColor, backgroundColor: theme.badgeBackgroundColor }}>
                  <div className="p-2.5 rounded-full bg-zinc-950/40" style={{ color: theme.accentColor }}>
                    {renderIcon(slide.visualAid.icon)}
                  </div>
                  <p className="text-xs text-center leading-relaxed italic font-sans" style={{ color: theme.textColor }}>
                    {slide.visualAid.description}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      );

    default:
      return <div className="text-zinc-500 font-serif">Bố cục slide chưa được quy định.</div>;
  }
}

// ==========================================
// THÀNH PHẦN FORM CHỈNH SỬA CHI TIẾT TỪNG DÒNG SLIDE / CỐT LÕI
// ==========================================
interface SlideOutlineEditorFormProps {
  slide: SlideData;
  onChange: (updatedSlide: SlideData) => void;
  onMove: (dir: "up" | "down") => void;
  onAddNew: () => void;
  onDelete: () => void;
  currentIndex: number;
  totalLength: number;
}
function SlideOutlineEditorForm({
  slide,
  onChange,
  onMove,
  onAddNew,
  onDelete,
  currentIndex,
  totalLength
}: SlideOutlineEditorFormProps) {
  const [localTitle, setLocalTitle] = useState(slide.title);
  const [localLayout, setLocalLayout] = useState<SlideLayout>(slide.layout);
  const [localContent, setLocalContent] = useState<string[]>(slide.content);
  // Visual Aid
  const [localIcon, setLocalIcon] = useState(slide.visualAid?.icon || "Presentation");
  const [localDesc, setLocalDesc] = useState(slide.visualAid?.description || "");
  const [localStatNum, setLocalStatNum] = useState(slide.visualAid?.statNumber || "95%");
  const [localStatLbl, setLocalStatLbl] = useState(slide.visualAid?.statLabel || "");
  // Image Illustration
  const [localImageUrl, setLocalImageUrl] = useState(slide.imageUrl || "");
  const [localImageKeywords, setLocalImageKeywords] = useState(slide.imageKeywords || "");

  // Đồng bộ lại khi thay đổi vị trí slide
  useEffect(() => {
    setLocalTitle(slide.title);
    setLocalLayout(slide.layout);
    setLocalContent(slide.content);
    setLocalIcon(slide.visualAid?.icon || "Presentation");
    setLocalDesc(slide.visualAid?.description || "");
    setLocalStatNum(slide.visualAid?.statNumber || "95%");
    setLocalStatLbl(slide.visualAid?.statLabel || "");
    setLocalImageUrl(slide.imageUrl || "");
    setLocalImageKeywords(slide.imageKeywords || "");
  }, [slide, currentIndex]);

  const handleApplyChanges = (
    updatedTitle: string,
    updatedLayout: SlideLayout,
    updatedContent: string[],
    updatedIcon: string,
    updatedDesc: string,
    updatedStatNum: string,
    updatedStatLbl: string,
    updatedImageUrl: string,
    updatedImageKeywords: string
  ) => {
    const updatedSlide: SlideData = {
      title: updatedTitle,
      layout: updatedLayout,
      content: updatedContent,
      imageUrl: updatedImageUrl,
      imageKeywords: updatedImageKeywords,
      visualAid: {
        type: updatedLayout === "stats" ? "statistic" : "icon",
        icon: updatedIcon,
        description: updatedDesc,
        statNumber: updatedStatNum,
        statLabel: updatedStatLbl
      }
    };
    onChange(updatedSlide);
  };

  const handleBulletChange = (idx: number, textVal: string) => {
    const nextArr = [...localContent];
    nextArr[idx] = textVal;
    setLocalContent(nextArr);
    handleApplyChanges(localTitle, localLayout, nextArr, localIcon, localDesc, localStatNum, localStatLbl, localImageUrl, localImageKeywords);
  };

  const handleAddBulletRow = () => {
    if (localContent.length >= 5) {
      alert("Khuyến cáo sư phạm: Tránh có quá 5 gạch đầu dòng để slide Times New Roman 28pt đạt hiệu quả thẩm mỹ tốt nhất!");
    }
    const nextArr = [...localContent, "Nội dung ý mới thêm"];
    setLocalContent(nextArr);
    handleApplyChanges(localTitle, localLayout, nextArr, localIcon, localDesc, localStatNum, localStatLbl, localImageUrl, localImageKeywords);
  };

  const handleDeleteBulletRow = (idx: number) => {
    const nextArr = localContent.filter((_, i) => i !== idx);
    setLocalContent(nextArr);
    handleApplyChanges(localTitle, localLayout, nextArr, localIcon, localDesc, localStatNum, localStatLbl, localImageUrl, localImageKeywords);
  };

  const handleNormalizeSlide = () => {
    const normTitle = normalizeVietnameseText(localTitle);
    const normContent = localContent.map(text => normalizeVietnameseText(text));
    const normDesc = normalizeVietnameseText(localDesc);
    const normStatLbl = normalizeVietnameseText(localStatLbl);

    setLocalTitle(normTitle);
    setLocalContent(normContent);
    setLocalDesc(normDesc);
    setLocalStatLbl(normStatLbl);

    handleApplyChanges(
      normTitle,
      localLayout,
      normContent,
      localIcon,
      normDesc,
      localStatNum,
      normStatLbl,
      localImageUrl,
      localImageKeywords
    );
  };

  return (
    <div className="flex flex-col gap-5 text-left" id="editor_form_container">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Edit className="w-4 h-4 text-amber-500" /> Biên Tập Slide #{currentIndex + 1}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNormalizeSlide}
            className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-md px-2 py-1 flex items-center gap-1 transition-all"
            title="Tự động chuẩn hóa dấu câu và khoảng trắng Tiếng Việt chuẩn mực sư phạm"
          >
            <Sparkles className="w-3 h-3 text-amber-400" /> Chuẩn hóa
          </button>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-mono">
            {localLayout.toUpperCase()}
          </span>
        </div>
      </div>

      {/* FIELD 1: TIÊU ĐỀ SLIDE */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-400 font-medium">Tiêu đề slide trình giảng:</label>
        <input
          type="text"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-amber-500 outline-none"
          value={localTitle}
          onChange={(e) => {
            setLocalTitle(e.target.value);
            handleApplyChanges(e.target.value, localLayout, localContent, localIcon, localDesc, localStatNum, localStatLbl, localImageUrl, localImageKeywords);
          }}
        />
      </div>

      {/* FIELD 2: CHỌN LAYOUT BỐ CỤC */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-400 font-medium">Sắp xếp layout kiến trúc:</label>
        <select
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-amber-500 outline-none"
          value={localLayout}
          onChange={(e) => {
            const nextL = e.target.value as SlideLayout;
            setLocalLayout(nextL);
            handleApplyChanges(localTitle, nextL, localContent, localIcon, localDesc, localStatNum, localStatLbl, localImageUrl, localImageKeywords);
          }}
        >
          <option value="title">Slide Tiêu đề giới thiệu (Title)</option>
          <option value="intro">Tổng quan mục tiêu học tập (Intro)</option>
          <option value="points">Các luận điểm chính tóm lược (Points)</option>
          <option value="two_column">Đối chiếu song song hai cột (Two Column)</option>
          <option value="quote">Khung trích dẫn lời vàng (Quote)</option>
          <option value="stats">Số liệu thống kê nghiên cứu (Stats)</option>
          <option value="conclusion">Slide tổng kết dặn dò (Conclusion)</option>
          <option value="divider">Slide phân chương/mục lớn (Divider)</option>
          <option value="summary">Slide tóm tắt tóm lược bài giảng (Summary)</option>
        </select>
      </div>

      {/* FIELD 3: CÁC DÒNG NỘI DUNG (BULLET POINTS) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400 font-medium">Các ý gạch đầu dòng (Times New Roman 28pt lý tưởng):</label>
          <button
            onClick={handleAddBulletRow}
            className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Thêm dòng mới
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {localContent.map((pointText, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-zinc-600 text-xs shrink-0 font-mono">#{index + 1}</span>
              <input
                type="text"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:border-amber-500 outline-none"
                value={pointText}
                onChange={(e) => handleBulletChange(index, e.target.value)}
              />
              <button
                onClick={() => handleDeleteBulletRow(index)}
                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                title="Xóa dòng này"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FIELD 4: THIẾT BỊ TRỰC QUAN (VISUAL AID) */}
      {localLayout !== "title" && localLayout !== "two_column" && localLayout !== "divider" && (
        <div className="border border-zinc-850 bg-zinc-950/40 p-4 rounded-xl flex flex-col gap-3.5">
          <span className="text-xs font-semibold text-amber-500 font-mono">QUẢN TRỊ TRỰC QUAN (VISUAL DESIGNS)</span>
          
          {localLayout === "stats" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500">Con số nổi bật:</label>
                <input
                  type="text"
                  className="bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-white outline-none"
                  value={localStatNum}
                  onChange={(e) => {
                    setLocalStatNum(e.target.value);
                    handleApplyChanges(localTitle, localLayout, localContent, localIcon, localDesc, e.target.value, localStatLbl, localImageUrl, localImageKeywords);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500">Tên mô tả số liệu:</label>
                <input
                  type="text"
                  className="bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-white outline-none"
                  value={localStatLbl}
                  onChange={(e) => {
                    setLocalStatLbl(e.target.value);
                    handleApplyChanges(localTitle, localLayout, localContent, localIcon, localDesc, localStatNum, e.target.value, localImageUrl, localImageKeywords);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500">Lucide biểu tượng tiếng Anh phù hợp (ví dụ: Presentation, GraduationCap, Target, Clock):</label>
              <input
                type="text"
                className="bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-white outline-none"
                value={localIcon}
                onChange={(e) => {
                  setLocalIcon(e.target.value);
                  handleApplyChanges(localTitle, localLayout, localContent, e.target.value, localDesc, localStatNum, localStatLbl, localImageUrl, localImageKeywords);
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-zinc-500">Gợi ý kỹ thuật vẽ sơ đồ / Sư phạm tranh ảnh cho bài thuyết trình:</label>
            <textarea
              className="w-full h-16 bg-zinc-950 border border-zinc-850 rounded p-2 text-xs text-zinc-300 outline-none resize-none placeholder-zinc-750"
              value={localDesc}
              onChange={(e) => {
                setLocalDesc(e.target.value);
                handleApplyChanges(localTitle, localLayout, localContent, localIcon, e.target.value, localStatNum, localStatLbl, localImageUrl, localImageKeywords);
              }}
            />
          </div>
        </div>
      )}

      {/* FIELD 5: THIẾT LẬP ẢNH MINH HỌA (IMAGE ILLUSTRATION) */}
      <div className="border border-zinc-850 bg-zinc-950/40 p-4 rounded-xl flex flex-col gap-3.5">
        <span className="text-xs font-semibold text-amber-500 font-mono">Ý TƯỞNG TRỰC QUAN (IMAGE ILLUSTRATION)</span>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500">Từ khóa tiếng Anh tìm ảnh (ví dụ: space-exploration, classroom, biology):</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-white outline-none focus:border-amber-500"
              value={localImageKeywords}
              placeholder="Ví dụ: science, research"
              onChange={(e) => {
                const kw = e.target.value.toLowerCase().replace(/\s+/g, "-");
                setLocalImageKeywords(kw);
                const nextUrl = kw ? `https://loremflickr.com/640/480/${kw}` : "";
                setLocalImageUrl(nextUrl);
                handleApplyChanges(localTitle, localLayout, localContent, localIcon, localDesc, localStatNum, localStatLbl, nextUrl, kw);
              }}
            />
            <button
              onClick={() => {
                const seed = Math.floor(Math.random() * 100);
                const kw = localImageKeywords || "education";
                const nextUrl = `https://loremflickr.com/640/480/${kw}?lock=${seed}`;
                setLocalImageUrl(nextUrl);
                handleApplyChanges(localTitle, localLayout, localContent, localIcon, localDesc, localStatNum, localStatLbl, nextUrl, kw);
              }}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded text-xs transition-colors shrink-0 font-sans"
              title="Đổi mẫu ảnh khác cùng chủ đề"
            >
              Đổi ảnh
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-500">Hoặc dán trực tiếp đường dẫn ảnh bất kỳ (CDN / Unsplash...):</label>
          <input
            type="text"
            className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-xs text-white outline-none focus:border-amber-500"
            value={localImageUrl}
            placeholder="https://images.unsplash.com/photo-..."
            onChange={(e) => {
              setLocalImageUrl(e.target.value);
              handleApplyChanges(localTitle, localLayout, localContent, localIcon, localDesc, localStatNum, localStatLbl, e.target.value, localImageKeywords);
            }}
          />
        </div>

        {localImageUrl && (
          <div className="flex items-center gap-3 mt-1 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
            <img
              src={localImageUrl}
              alt="Preview"
              className="w-16 h-12 object-cover rounded-md border border-zinc-700/50"
              referrerPolicy="no-referrer"
            />
            <div className="text-left flex-1 min-w-0">
              <span className="text-[10px] text-zinc-400 font-mono block truncate">{localImageUrl}</span>
              <span className="text-[9px] text-zinc-500 font-mono block">Cấu hình liên kết hoạt họa hoạt động</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// THÀNH PHẦN SIDEBAR HIỂN THỊ DANH SÁCH LỊCH SỬ Slide Đã Soạn
// ==========================================
interface HistorySidebarPanelProps {
  historyList: any[];
  loadHistoryItem: (item: any) => void;
  deleteHistoryItem: (e: React.MouseEvent, item: any) => void;
  currentUserId: string;
}
function HistorySidebarPanel({
  historyList,
  loadHistoryItem,
  deleteHistoryItem,
  currentUserId
}: HistorySidebarPanelProps) {
  return (
    <div className="flex flex-col gap-2.5 text-left" id="history_list_scroller">
      {historyList.length === 0 ? (
        <div className="text-center py-8 border border-zinc-900 rounded-xl bg-zinc-900/10">
          <p className="text-xs text-zinc-600">Bài giảng trống</p>
          <span className="text-[10px] text-zinc-700 block mt-1">Lịch sử tự động lưu tại đây</span>
        </div>
      ) : (
        historyList.map((item, idx) => {
          let countSlides = 0;
          try {
            countSlides = JSON.parse(item.slidesJson).length;
          } catch (_) {}

          const dateStr = item.createdAt 
            ? new Date(item.createdAt).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" })
            : "Gần đây";

          return (
            <div
              key={idx}
              onClick={() => loadHistoryItem(item)}
              className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 rounded-xl p-3 flex items-start justify-between cursor-pointer transition-all group"
            >
              <div className="flex items-start gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-amber-500 border border-zinc-850 shrink-0 mt-0.5">
                  <PresentationIcon className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold truncate text-zinc-200 group-hover:text-white">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-850">
                      {countSlides} SLIDES
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono inline-flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {dateStr}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteHistoryItem(e, item);
                }}
                className="p-1.5 rounded-lg bg-zinc-950/60 hover:bg-rose-500/15 border border-zinc-800/40 hover:border-rose-500/30 text-zinc-400 hover:text-rose-450 shrink-0 transition-all ml-1.5 mt-1 relative z-10"
                title="Xóa bài soạn"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
