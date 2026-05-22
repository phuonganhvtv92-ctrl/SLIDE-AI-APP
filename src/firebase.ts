/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Định nghĩa Mã lỗi chuẩn Firestore và mô phỏng khi chưa điền Key
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

// Kiểm tra xem Firebase Config có hợp lệ không (có apiKey không rỗng)
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let app;
let db: any = null;
let auth: any = null;
let googleProvider: any = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    // CRITICAL: Tránh lỗi thiếu nạp firestoreDatabaseId của config
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log("[FIREBASE] Đã kết nối Firebase Firestore & Auth thành công.");
  } catch (err) {
    console.error("[FIREBASE] Không thể khởi tạo SDK Firebase:", err);
  }
} else {
  console.warn("[FIREBASE] Chưa thiết lập Firebase trong Secrets. Ứng dụng sẽ hoạt động ở chế độ lưu trữ LocalStorage.");
}

export { db, auth, googleProvider };

// Trình bắt và chuẩn hóa lỗi bảo mật Firestore bắt buộc theo Skill
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Hàm kiểm thử kết nối trực tiếp đến Firestore
export async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Không kết nối được server Firestore: Trình khách đang offline.");
    }
  }
}

if (db) {
  testConnection();
}
