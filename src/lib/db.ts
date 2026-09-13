import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db as firestoreDb, auth as firebaseAuth, handleFirestoreError, OperationType } from "./firebase";

export interface Trade {
  id: string;
  created_at: string;
  symbol: string;
  timeframe: string;
  bias: string;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  risk_reward: string;
  image_url: string;
  notes: string;
  status: "PENDING" | "WON" | "LOST" | "BREAKEAVEN";
  exit_price?: number;
  pnl?: number;
  analysis_info?: {
    marketStructure: string;
    orderBlock: {
      priceRange: string;
      type: string;
      rationale: string;
    };
    supplyDemandZones: {
      supply: string;
      demand: string;
      activeZone: string;
    };
    fibonacciRetracement: {
      level_50: number;
      level_618: number;
      level_786: number;
      description: string;
    };
    tradeSetup: {
      type: string;
      entry: number;
      stopLoss: number;
      takeProfits: number[];
      riskRewardRatio: string;
      rationale: string;
    };
    educationalInsight?: string;
  };
}

// Key names in Local Storage
const LOCAL_TRADES_KEY = "synthetic_smc_local_trades";

// Save trade records
export async function saveTrade(tradeData: Omit<Trade, "id" | "created_at">): Promise<Trade> {
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);

  const fullTrade: Trade = {
    ...tradeData,
    id,
    created_at: timestamp,
  };

  // 1. Try Firebase Firestore if logged in
  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      const tradeRef = doc(firestoreDb, "trades", id);
      const docPayload = {
        userId: firebaseAuth.currentUser.uid,
        created_at: serverTimestamp(),
        symbol: tradeData.symbol,
        timeframe: tradeData.timeframe,
        bias: tradeData.bias,
        entry_price: Number(tradeData.entry_price) || 0.0,
        stop_loss: Number(tradeData.stop_loss) || 0.0,
        take_profit: Number(tradeData.take_profit) || 0.0,
        risk_reward: tradeData.risk_reward || "",
        image_url: tradeData.image_url || "",
        notes: tradeData.notes || "",
        status: tradeData.status,
        analysis_info: tradeData.analysis_info || null,
        exit_price: tradeData.exit_price !== undefined ? Number(tradeData.exit_price) : null,
        pnl: tradeData.pnl !== undefined ? Number(tradeData.pnl) : null
      };

      await setDoc(tradeRef, docPayload);
      
      return {
        ...fullTrade,
        id,
      };
    } catch (err: any) {
      console.error("Firestore save exception:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  // 2. Local storage engine fallback (guarantees zero-failure experience)
  const localTrades = getLocalTrades();
  localTrades.unshift(fullTrade);
  localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(localTrades));
  return fullTrade;
}

// Retrieve trade records
export async function getTrades(): Promise<Trade[]> {
  // 1. Try Firebase Firestore if logged in
  if (firebaseAuth.currentUser) {
    const path = "trades";
    try {
      const q = query(
        collection(firestoreDb, "trades"),
        where("userId", "==", firebaseAuth.currentUser.uid),
        orderBy("created_at", "desc")
      );
      const snapshot = await getDocs(q);
      const fetchedTrades: Trade[] = [];
      
      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const d = docSnap.data();
        
        // Handle Firestore server timestamp conversion
        const created_at = d.created_at && typeof d.created_at.toDate === "function"
          ? d.created_at.toDate().toISOString()
          : (d.created_at || new Date().toISOString());

        fetchedTrades.push({
          id,
          created_at,
          symbol: d.symbol || "",
          timeframe: d.timeframe || "",
          bias: d.bias || "",
          entry_price: Number(d.entry_price) || 0.0,
          stop_loss: Number(d.stop_loss) || 0.0,
          take_profit: Number(d.take_profit) || 0.0,
          risk_reward: d.risk_reward || "",
          image_url: d.image_url || "",
          notes: d.notes || "",
          status: d.status || "PENDING",
          analysis_info: d.analysis_info || undefined,
          exit_price: d.exit_price !== undefined && d.exit_price !== null ? Number(d.exit_price) : undefined,
          pnl: d.pnl !== undefined && d.pnl !== null ? Number(d.pnl) : undefined
        });
      });
      return fetchedTrades;
    } catch (err: any) {
      console.error("Firestore getTrades exception:", err);
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  // 2. Local storage fallback
  return getLocalTrades();
}

// Subscribe to real-time updates for trades if logged in, otherwise load once and return empty unsubscriber
export function subscribeTrades(callback: (trades: Trade[]) => void, onError: (err: any) => void): () => void {
  if (firebaseAuth.currentUser) {
    const q = query(
      collection(firestoreDb, "trades"),
      where("userId", "==", firebaseAuth.currentUser.uid),
      orderBy("created_at", "desc")
    );
    return onSnapshot(q, (snapshot) => {
      const fetchedTrades: Trade[] = [];
      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const d = docSnap.data();
        
        const created_at = d.created_at && typeof d.created_at.toDate === "function"
          ? d.created_at.toDate().toISOString()
          : (d.created_at || new Date().toISOString());

        fetchedTrades.push({
          id,
          created_at,
          symbol: d.symbol || "",
          timeframe: d.timeframe || "",
          bias: d.bias || "",
          entry_price: Number(d.entry_price) || 0.0,
          stop_loss: Number(d.stop_loss) || 0.0,
          take_profit: Number(d.take_profit) || 0.0,
          risk_reward: d.risk_reward || "",
          image_url: d.image_url || "",
          notes: d.notes || "",
          status: d.status || "PENDING",
          analysis_info: d.analysis_info || undefined,
          exit_price: d.exit_price !== undefined && d.exit_price !== null ? Number(d.exit_price) : undefined,
          pnl: d.pnl !== undefined && d.pnl !== null ? Number(d.pnl) : undefined
        });
      });
      callback(fetchedTrades);
    }, (err) => {
      console.error("Firestore onSnapshot subscription error:", err);
      onError(err);
    });
  }

  // Fallback if not logged in
  getTrades().then(callback).catch(onError);
  return () => {};
}

// Remove trade record
export async function deleteTrade(id: string): Promise<boolean> {
  // 1. Try Firebase Firestore if logged in
  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      const docRef = doc(firestoreDb, "trades", id);
      await deleteDoc(docRef);
      return true;
    } catch (err: any) {
      console.error("Firestore delete exception:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  // 2. Local sync fallback
  const localTrades = getLocalTrades();
  const filtered = localTrades.filter((t) => t.id !== id);
  localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(filtered));
  return true;
}

// Update notes / append custom context to an existing trade
export async function updateTradeNotes(
  id: string,
  notes: string
): Promise<boolean> {
  // 1. Try Firebase Firestore if logged in
  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      const docRef = doc(firestoreDb, "trades", id);
      await updateDoc(docRef, { notes });
      return true;
    } catch (err: any) {
      console.error("Firestore update notes exception:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  const localTrades = getLocalTrades();
  const index = localTrades.findIndex((t) => t.id === id);
  if (index !== -1) {
    localTrades[index].notes = notes;
    localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(localTrades));
    return true;
  }
  return false;
}

// Update status of saved trades (WON, LOST, BREAKEAVEN, PENDING) with optional exit_price and pnl
export async function updateTradeStatus(
  id: string, 
  status: "PENDING" | "WON" | "LOST" | "BREAKEAVEN",
  exit_price?: number,
  pnl?: number
): Promise<boolean> {
  // 1. Try Firebase Firestore if logged in
  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      const docRef = doc(firestoreDb, "trades", id);
      const updateData: any = { status };
      if (exit_price !== undefined) updateData.exit_price = exit_price;
      if (pnl !== undefined) updateData.pnl = pnl;
      
      await updateDoc(docRef, updateData);
      return true;
    } catch (err: any) {
      console.error("Firestore update status exception:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  const localTrades = getLocalTrades();
  const index = localTrades.findIndex((t) => t.id === id);
  if (index !== -1) {
    localTrades[index].status = status;
    if (exit_price !== undefined) localTrades[index].exit_price = exit_price;
    if (pnl !== undefined) localTrades[index].pnl = pnl;
    localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(localTrades));
    return true;
  }
  return false;
}

// Get raw backup list from localStorage
function getLocalTrades(): Trade[] {
  try {
    const raw = localStorage.getItem(LOCAL_TRADES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error parsing local trades list:", e);
    return [];
  }
}
