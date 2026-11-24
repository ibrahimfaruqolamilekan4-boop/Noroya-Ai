import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import {
  db as firestoreDb,
  auth as firebaseAuth,
  handleFirestoreError,
  OperationType,
} from "./firebase";

export interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  sender: "user" | "bot";
  created_at: any;
}

export interface UserLearningItem {
  id: string;
  userId: string;
  learnings: string;
  symbol: string;
  category: string;
  created_at: any;
}

function generateValidDocId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function toTimestampMs(raw: any): number {
  if (raw && typeof raw.toDate === "function") return raw.toDate().getTime();
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "string") {
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

// ----------------------------------------------------
// CHAT HISTORY MANAGEMENT (/chat_history/{chatId})
// ----------------------------------------------------
export async function saveChatMessage(
  messageText: string,
  sender: "user" | "bot"
): Promise<void> {
  if (!firebaseAuth.currentUser) return;
  const userId = firebaseAuth.currentUser.uid;
  const id = generateValidDocId();
  const path = `chat_history/${id}`;

  const safeMsg = (messageText || "").trim().slice(0, 20000);
  if (!safeMsg) return;

  try {
    await setDoc(doc(firestoreDb, "chat_history", id), {
      userId,
      message: safeMsg,
      sender,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function getChatHistory(maxLimit = 50): Promise<ChatMessage[]> {
  if (!firebaseAuth.currentUser) return [];
  const userId = firebaseAuth.currentUser.uid;
  const path = "chat_history";

  try {
    // Filter by userId and sort client-side (no composite index required)
    const q = query(
      collection(firestoreDb, "chat_history"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const messages: ChatMessage[] = [];

    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      messages.push({
        id: docSnap.id,
        userId: d.userId || "",
        message: d.message || "",
        sender: d.sender === "bot" ? "bot" : "user",
        created_at: d.created_at,
      });
    });

    messages.sort((a, b) => toTimestampMs(a.created_at) - toTimestampMs(b.created_at));
    return messages.slice(-maxLimit);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// ----------------------------------------------------
// USER LEARNINGS ("Learn From Me" mode — /user_learnings/{learningId})
// ----------------------------------------------------
export async function saveUserLearning(
  learnings: string,
  symbol: string,
  category: string
): Promise<UserLearningItem | null> {
  if (!firebaseAuth.currentUser) return null;
  const userId = firebaseAuth.currentUser.uid;
  const id = generateValidDocId();
  const path = `user_learnings/${id}`;

  const safeLearnings = (learnings || "").trim().slice(0, 3000);
  const safeSymbol = (symbol || "General").trim().slice(0, 64);
  const safeCategory = (category || "General").trim().slice(0, 64) || "General";
  if (!safeLearnings) return null;

  try {
    await setDoc(doc(firestoreDb, "user_learnings", id), {
      userId,
      learnings: safeLearnings,
      symbol: safeSymbol,
      category: safeCategory,
      created_at: serverTimestamp(),
    });
    return {
      id,
      userId,
      learnings: safeLearnings,
      symbol: safeSymbol,
      category: safeCategory,
      created_at: new Date(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function getUserLearnings(): Promise<UserLearningItem[]> {
  if (!firebaseAuth.currentUser) return [];
  const userId = firebaseAuth.currentUser.uid;
  const path = "user_learnings";

  try {
    const q = query(
      collection(firestoreDb, "user_learnings"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const items: UserLearningItem[] = [];

    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        userId: d.userId || "",
        learnings: d.learnings || "",
        symbol: d.symbol || "General",
        category: d.category || "General",
        created_at: d.created_at,
      });
    });

    items.sort((a, b) => toTimestampMs(b.created_at) - toTimestampMs(a.created_at));
    return items;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function deleteUserLearning(id: string): Promise<boolean> {
  if (!firebaseAuth.currentUser) return false;
  const path = `user_learnings/${id}`;
  try {
    await deleteDoc(doc(firestoreDb, "user_learnings", id));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
