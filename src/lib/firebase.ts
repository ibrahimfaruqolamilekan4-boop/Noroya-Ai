import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase app with provisioned configuration
const app = initializeApp(firebaseConfig);

// Initialize Firestore targeting the provisioned named database
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Google Auth Provider (Popup flow for iframe compatibility)
export const googleProvider = new GoogleAuthProvider();

export const firebaseProjectId = firebaseConfig.projectId;
export const firebaseDatabaseId = firebaseConfig.firestoreDatabaseId;

// Required startup connection check to detect offline/misconfigured Firestore early
let connectionChecked = false;
export async function testConnection(): Promise<boolean> {
  if (connectionChecked) return true;
  connectionChecked = true;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("the client is offline")) {
      console.error("Please check your Firebase configuration: Firestore client is offline.");
      return false;
    }
    // Permission denied on test/connection still confirms live server connectivity
    return true;
  }
}

// Run startup connectivity probe immediately on client boot
if (typeof window !== "undefined") {
  void testConnection();
}

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
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Compresses large base64 chart screenshots so Firestore documents stay
 * safely below the 1MB document limit (and within blueprint's 350KB ceiling).
 */
export async function compressImageForFirestore(
  imageUrl?: string | null,
  maxChars = 300000
): Promise<string> {
  if (!imageUrl || typeof imageUrl !== "string") return "";
  if (imageUrl.length <= maxChars) return imageUrl;
  if (!imageUrl.startsWith("data:image/") || typeof window === "undefined") {
    return imageUrl.length <= maxChars ? imageUrl : "";
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const maxWidth = 960;
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve("");
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          for (const quality of [0.7, 0.5, 0.35]) {
            const compressed = canvas.toDataURL("image/jpeg", quality);
            if (compressed.length <= maxChars) {
              resolve(compressed);
              return;
            }
          }
          resolve("");
        } catch {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = imageUrl;
    } catch {
      resolve("");
    }
  });
}
