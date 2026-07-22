import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { db as firestoreDb, auth as firebaseAuth } from "./firebase";

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

// ----------------------------------------------------
// CHAT HISTORY MANAGEMENT
// ----------------------------------------------------

export async function saveChatMessage(messageText: string, sender: "user" | "bot"): Promise<void> {
  if (!firebaseAuth.currentUser) return;
  const userId = firebaseAuth.currentUser.uid;
  
  try {
    const chatRef = collection(firestoreDb, "chat_history");
    const docPayload = {
      userId,
      message: messageText,
      sender,
      created_at: serverTimestamp()
    };
    await addDoc(chatRef, docPayload);
  } catch (err) {
    console.error("Error saving chat message to Firestore:", err);
  }
}

export async function getChatHistory(maxLimit = 50): Promise<ChatMessage[]> {
  if (!firebaseAuth.currentUser) return [];
  const userId = firebaseAuth.currentUser.uid;

  try {
    const q = query(
      collection(firestoreDb, "chat_history"),
      where("userId", "==", userId),
      orderBy("created_at", "asc"),
      limit(maxLimit)
    );
    const snapshot = await getDocs(q);
    const messages: ChatMessage[] = [];
    
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      messages.push({
        id: docSnap.id,
        userId: d.userId || "",
        message: d.message || "",
        sender: d.sender || "user",
        created_at: d.created_at
      });
    });
    return messages;
  } catch (err) {
    console.error("Error fetching chat history:", err);
    return [];
  }
}

// ----------------------------------------------------
// USER LEARNINGS ("Learn From Me" mode)
// ----------------------------------------------------

export async function saveUserLearning(learnings: string, symbol: string, category: string): Promise<UserLearningItem | null> {
  if (!firebaseAuth.currentUser) return null;
  const userId = firebaseAuth.currentUser.uid;

  try {
    const learningsRef = collection(firestoreDb, "user_learnings");
    const docPayload = {
      userId,
      learnings,
      symbol,
      category,
      created_at: serverTimestamp()
    };
    const docRef = await addDoc(learningsRef, docPayload);
    return {
      id: docRef.id,
      userId,
      learnings,
      symbol,
      category,
      created_at: new Date()
    };
  } catch (err) {
    console.error("Error saving user learning details to Firestore:", err);
    return null;
  }
}

export async function getUserLearnings(): Promise<UserLearningItem[]> {
  if (!firebaseAuth.currentUser) return [];
  const userId = firebaseAuth.currentUser.uid;

  try {
    const q = query(
      collection(firestoreDb, "user_learnings"),
      where("userId", "==", userId),
      orderBy("created_at", "desc")
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
        created_at: d.created_at
      });
    });
    return items;
  } catch (err) {
    console.error("Error fetching user learnings items:", err);
    return [];
  }
}
