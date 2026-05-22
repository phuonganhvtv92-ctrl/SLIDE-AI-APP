/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Định nghĩa layout của slide
export type SlideLayout = "title" | "intro" | "points" | "two_column" | "quote" | "stats" | "conclusion" | "divider" | "summary";

// Định nghĩa thiết bị hỗ trợ trực quan
export interface VisualAid {
  type: "icon" | "process" | "quote" | "statistic" | "diagram";
  icon: string; // Tên của Lucide-react icon
  description: string; // Mô tả gợi ý trực quan cho giáo viên
  header?: string;
  statNumber?: string;
  statLabel?: string;
}

// Định nghĩa một Slide đơn lẻ
export interface SlideData {
  title: string;
  content: string[]; // Các dòng nội dung tóm tắt
  layout: SlideLayout;
  visualAid?: VisualAid;
  imageUrl?: string;
  imageKeywords?: string;
}

// Định nghĩa Theme màu sắc cho slide
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  backgroundColor: string;
  titleColor: string;
  textColor: string;
  accentColor: string;
  borderColor: string;
  badgeBackgroundColor: string;
  gradient?: string; // Tùy chọn dải màu gradient hiện đại cho Web preview
}

// Danh sách các Theme Preset gợi ý
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "academic-blue",
    name: "Academic Blue (Xanh Học Thuật)",
    description: "Sắc xanh Oxford thâm nghiêm kết hợp vàng đồng cổ học, mang vẻ đẹp tri thức hàn lâm kinh điển.",
    backgroundColor: "#0B1B3D",
    titleColor: "#FFFFFF",
    textColor: "#E2E8F0",
    accentColor: "#F59E0B",
    borderColor: "#1E293B",
    badgeBackgroundColor: "#0F172A"
  },
  {
    id: "modern-purple-gradient",
    name: "Modern Purple Gradient (Tím Chuyển Sắc)",
    description: "Chuyển dải sắc Nebula mượt mà từ tím sâu thẳm sang hồng điện tử, bắt nhịp xu thế AI công nghệ.",
    backgroundColor: "#1E1B4B",
    gradient: "linear-gradient(135deg, #1E1B4B 0%, #4C1D95 50%, #7C3AED 100%)",
    titleColor: "#FFFFFF",
    textColor: "#E0E7FF",
    accentColor: "#F472B6",
    borderColor: "#4338CA",
    badgeBackgroundColor: "#312E81"
  },
  {
    id: "corporate-dark",
    name: "Corporate Dark (Doanh Nghiệp Tối)",
    description: "Xanh thép Navy tinh tế phác hoạ sự vững chãi, uy tín, tin cậy tuyệt đối chuẩn tập đoàn.",
    backgroundColor: "#0F172A",
    titleColor: "#F8FAFC",
    textColor: "#CBD5E1",
    accentColor: "#38BDF8",
    borderColor: "#1E293B",
    badgeBackgroundColor: "#1E293B"
  },
  {
    id: "elegant-black-gold",
    name: "Elegant Black Gold (Đen Vàng Sang Trọng)",
    description: "Vẻ đẹp Luxury huyền bí của nền đen siêu sâu tương phản rực rỡ với sắc vàng ánh kim rực rỡ.",
    backgroundColor: "#111111",
    titleColor: "#FAFAFA",
    textColor: "#E4E4E7",
    accentColor: "#EA580C",
    borderColor: "#27272A",
    badgeBackgroundColor: "#18181B"
  },
  {
    id: "minimal-white",
    name: "Minimal White (Trắng Tối Giản)",
    description: "Bản sắc tối giản vùng Scandinavian: nền Alabaster nhã nhặn, hiển thị chữ đen cực kỳ tinh gọn.",
    backgroundColor: "#FAF9F6",
    titleColor: "#18181B",
    textColor: "#3F3F46",
    accentColor: "#111111",
    borderColor: "#E4E4E7",
    badgeBackgroundColor: "#F4F4F5"
  },
  {
    id: "creative-orange",
    name: "Creative Orange (Sáng Tạo Cam)",
    description: "Gam cam năng lượng cực kỳ rực rỡ bứt phá trên nền tối anthracite cá tính, khơi dậy sáng tạo.",
    backgroundColor: "#18181B",
    titleColor: "#FAFAFA",
    textColor: "#D4D4D8",
    accentColor: "#EA580C",
    borderColor: "#27272A",
    badgeBackgroundColor: "#09090B"
  },
  {
    id: "cinematic-dark",
    name: "Cinematic Dark (Phim Điện Ảnh)",
    description: "Sự tương phản kịch tính giữa nền than xám thâm trầm và vệt đỏ Neon Cinema Retro nghệ thuật.",
    backgroundColor: "#0C0A09",
    titleColor: "#FAFAFA",
    textColor: "#D6D3D1",
    accentColor: "#E11D48",
    borderColor: "#292524",
    badgeBackgroundColor: "#1C1917"
  },
  {
    id: "technology-neon",
    name: "Technology Neon (Công Nghệ Neon)",
    description: "Chiều sâu kỷ nguyên số Cyberpunk với xanh bảo ngọc phát quang cuốn hút thời thượng.",
    backgroundColor: "#020617",
    titleColor: "#F8FAFC",
    textColor: "#94A3B8",
    accentColor: "#10B981",
    borderColor: "#1E293B",
    badgeBackgroundColor: "#0F172A"
  }
];

// Định nghĩa bản trình chiếu hoàn chỉnh được lưu trữ
export interface Presentation {
  id: string;
  userId: string;
  title: string;
  themePreset: string; // ID của ThemePreset
  createdAt: any; // Firebase Timestamp hoặc Date string
  slidesJson: string; // Chuỗi JSON chứa SlideData[]
}
