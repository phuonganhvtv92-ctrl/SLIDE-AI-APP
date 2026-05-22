/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Chuẩn hóa văn bản Tiếng Việt: loại bỏ khoảng trắng thừa, sửa lỗi dấu câu và viết hoa đầu câu.
 */
export function normalizeVietnameseText(text: string): string {
  if (!text) return "";

  // Xóa khoảng trắng thừa
  text = text.replace(/\s+/g, " ").trim();

  // Thêm khoảng trắng sau dấu câu nếu thiếu (phía trước là chữ/số, phía sau là chữ/số không có cách)
  text = text.replace(/([.,!?;:])([^\s\d])/g, "$1 $2");

  // Viết hoa chữ đầu câu
  text = text.replace(
    /(^|[.!?]\s+)([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])/g,
    (match, p1, p2) => p1 + p2.toUpperCase()
  );

  return text;
}
