import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  db as firestoreDb,
  auth as firebaseAuth,
  handleFirestoreError,
  OperationType,
  compressImageForFirestore,
} from "./firebase";
import type { TradingStyle } from "./quantEngine";

export interface Trade {
  id: string;
  created_at: string;
  symbol: string;
  timeframe: string;
  trading_style?: TradingStyle;
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
    marketStructure?: string;
    orderBlock?: {
      priceRange: string;
      type: string;
      rationale: string;
    };
    supplyDemandZones?: {
      supply: string;
      demand: string;
      activeZone: string;
    };
    fibonacciRetracement?: {
      level_50: number;
      level_618: number;
      level_786: number;
      description: string;
    };
    tradeSetup?: {
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

export interface SavedAnalysisReport {
  id: string;
  created_at: string;
  symbol: string;
  timeframe: string;
  tradingStyle: TradingStyle;
  bias: string;
  confluenceScorePct: number;
  summary: string;
  entry: number;
  stopLoss: number;
  tp1: number;
  riskReward: string;
  reportData?: Record<string, any>;
}

export interface UserPreferences {
  tradingStyle: TradingStyle;
  defaultSymbol: string;
  defaultTimeframe: string;
  accountBalance?: number;
  riskPercent?: number;
  updated_at?: string;
}

const LOCAL_TRADES_KEY = "synthetic_smc_local_trades";
const LOCAL_REPORTS_KEY = "synthetic_smc_local_reports";

function clampStr(val: unknown, maxLen: number, fallback = ""): string {
  const s = typeof val === "string" ? val.trim() : fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeNonNegNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function toIsoTimestamp(raw: any): string {
  if (raw && typeof raw.toDate === "function") {
    return raw.toDate().toISOString();
  }
  if (typeof raw === "string" && raw.length > 0) return raw;
  return new Date().toISOString();
}

function generateValidDocId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Strips undefined values and oversized strings from nested JSON objects
 * so Firestore setDoc never fails on undefined fields or 1MB payload limits.
 */
function sanitizeNestedObject(obj: any, maxDepth = 4): any {
  if (obj === null || obj === undefined) return null;
  if (maxDepth <= 0) return null;
  if (typeof obj === "string") return obj.length > 4000 ? obj.slice(0, 4000) : obj;
  if (typeof obj === "number") return Number.isFinite(obj) ? obj : 0;
  if (typeof obj === "boolean") return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 25).map((item) => sanitizeNestedObject(item, maxDepth - 1));
  }
  if (typeof obj === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || k === "imageBase64" || k === "image_url") continue;
      out[k] = sanitizeNestedObject(v, maxDepth - 1);
    }
    return out;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. TRADES COLLECTION (/trades/{tradeId})
// ---------------------------------------------------------------------------
export async function saveTrade(tradeData: Omit<Trade, "id" | "created_at">): Promise<Trade> {
  const timestamp = new Date().toISOString();
  const id = generateValidDocId();

  const fullTrade: Trade = {
    ...tradeData,
    id,
    created_at: timestamp,
  };

  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      const compressedImg = await compressImageForFirestore(tradeData.image_url, 320000);
      const tradeRef = doc(firestoreDb, "trades", id);
      const docPayload = {
        userId: firebaseAuth.currentUser.uid,
        created_at: serverTimestamp(),
        symbol: clampStr(tradeData.symbol, 64, "UNKNOWN") || "UNKNOWN",
        timeframe: clampStr(tradeData.timeframe, 16, "M15") || "M15",
        trading_style: tradeData.trading_style === "SCALP" ? "SCALP" : "NORMAL",
        bias: clampStr(tradeData.bias, 32, "NEUTRAL") || "NEUTRAL",
        entry_price: safeNonNegNumber(tradeData.entry_price, 0),
        stop_loss: safeNonNegNumber(tradeData.stop_loss, 0),
        take_profit: safeNonNegNumber(tradeData.take_profit, 0),
        risk_reward: clampStr(tradeData.risk_reward, 32, ""),
        image_url: compressedImg,
        notes: clampStr(tradeData.notes, 20000, ""),
        status: tradeData.status,
        analysis_info: tradeData.analysis_info
          ? sanitizeNestedObject(tradeData.analysis_info)
          : null,
        exit_price:
          tradeData.exit_price !== undefined && tradeData.exit_price !== null
            ? safeNonNegNumber(tradeData.exit_price, 0)
            : null,
        pnl:
          tradeData.pnl !== undefined && tradeData.pnl !== null && Number.isFinite(Number(tradeData.pnl))
            ? Number(tradeData.pnl)
            : null,
      };

      await setDoc(tradeRef, docPayload);
      return { ...fullTrade, image_url: compressedImg };
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  const localTrades = getLocalTrades();
  localTrades.unshift(fullTrade);
  localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(localTrades));
  return fullTrade;
}

function mapTradeDoc(id: string, d: Record<string, any>): Trade {
  return {
    id,
    created_at: toIsoTimestamp(d.created_at),
    symbol: d.symbol || "",
    timeframe: d.timeframe || "",
    trading_style: d.trading_style === "SCALP" ? "SCALP" : "NORMAL",
    bias: d.bias || "",
    entry_price: Number(d.entry_price) || 0,
    stop_loss: Number(d.stop_loss) || 0,
    take_profit: Number(d.take_profit) || 0,
    risk_reward: d.risk_reward || "",
    image_url: d.image_url || "",
    notes: d.notes || "",
    status: d.status || "PENDING",
    analysis_info: d.analysis_info || undefined,
    exit_price:
      d.exit_price !== undefined && d.exit_price !== null ? Number(d.exit_price) : undefined,
    pnl: d.pnl !== undefined && d.pnl !== null ? Number(d.pnl) : undefined,
  };
}

export async function getTrades(): Promise<Trade[]> {
  if (firebaseAuth.currentUser) {
    const path = "trades";
    try {
      // Avoid composite index requirement by filtering by userId and sorting client-side
      const q = query(
        collection(firestoreDb, "trades"),
        where("userId", "==", firebaseAuth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const fetchedTrades: Trade[] = [];
      snapshot.forEach((docSnap) => {
        fetchedTrades.push(mapTradeDoc(docSnap.id, docSnap.data()));
      });
      fetchedTrades.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return fetchedTrades;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  return getLocalTrades();
}

export function subscribeTrades(
  callback: (trades: Trade[]) => void,
  onError: (err: any) => void
): () => void {
  if (firebaseAuth.currentUser) {
    const path = "trades";
    const q = query(
      collection(firestoreDb, "trades"),
      where("userId", "==", firebaseAuth.currentUser.uid)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const fetchedTrades: Trade[] = [];
        snapshot.forEach((docSnap) => {
          fetchedTrades.push(mapTradeDoc(docSnap.id, docSnap.data()));
        });
        fetchedTrades.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        callback(fetchedTrades);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (structuredErr) {
          onError(structuredErr);
        }
      }
    );
  }

  callback(getLocalTrades());
  return () => {};
}

export async function deleteTrade(id: string): Promise<boolean> {
  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      await deleteDoc(doc(firestoreDb, "trades", id));
      return true;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  const filtered = getLocalTrades().filter((t) => t.id !== id);
  localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(filtered));
  return true;
}

export async function updateTradeNotes(id: string, notes: string): Promise<boolean> {
  const safeNotes = clampStr(notes, 20000, "");
  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      await updateDoc(doc(firestoreDb, "trades", id), { notes: safeNotes });
      return true;
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  const localTrades = getLocalTrades();
  const index = localTrades.findIndex((t) => t.id === id);
  if (index !== -1) {
    localTrades[index].notes = safeNotes;
    localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(localTrades));
    return true;
  }
  return false;
}

export async function updateTradeStatus(
  id: string,
  status: "PENDING" | "WON" | "LOST" | "BREAKEAVEN",
  exit_price?: number,
  pnl?: number
): Promise<boolean> {
  if (firebaseAuth.currentUser) {
    const path = `trades/${id}`;
    try {
      const updateData: Record<string, any> = { status };
      if (exit_price !== undefined) updateData.exit_price = safeNonNegNumber(exit_price, 0);
      if (pnl !== undefined && Number.isFinite(Number(pnl))) updateData.pnl = Number(pnl);
      await updateDoc(doc(firestoreDb, "trades", id), updateData);
      return true;
    } catch (err: any) {
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

export function getLocalTradesCount(): number {
  return getLocalTrades().length;
}

export async function migrateLocalTradesToFirestore(): Promise<number> {
  if (!firebaseAuth.currentUser) return 0;
  const localTrades = getLocalTrades();
  if (localTrades.length === 0) return 0;

  let migrated = 0;
  for (const t of localTrades) {
    const id = /^[a-zA-Z0-9_-]{1,128}$/.test(t.id) ? t.id : generateValidDocId();
    const path = `trades/${id}`;
    try {
      const compressedImg = await compressImageForFirestore(t.image_url, 300000);
      await setDoc(doc(firestoreDb, "trades", id), {
        userId: firebaseAuth.currentUser.uid,
        created_at: serverTimestamp(),
        symbol: clampStr(t.symbol, 64, "UNKNOWN") || "UNKNOWN",
        timeframe: clampStr(t.timeframe, 16, "M15") || "M15",
        trading_style: t.trading_style === "SCALP" ? "SCALP" : "NORMAL",
        bias: clampStr(t.bias, 32, "NEUTRAL") || "NEUTRAL",
        entry_price: safeNonNegNumber(t.entry_price, 0),
        stop_loss: safeNonNegNumber(t.stop_loss, 0),
        take_profit: safeNonNegNumber(t.take_profit, 0),
        risk_reward: clampStr(t.risk_reward, 32, ""),
        image_url: compressedImg,
        notes: clampStr(t.notes, 20000, ""),
        status: t.status || "PENDING",
        analysis_info: t.analysis_info ? sanitizeNestedObject(t.analysis_info) : null,
        exit_price: t.exit_price !== undefined ? safeNonNegNumber(t.exit_price, 0) : null,
        pnl: t.pnl !== undefined && Number.isFinite(Number(t.pnl)) ? Number(t.pnl) : null,
      });
      migrated++;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  localStorage.removeItem(LOCAL_TRADES_KEY);
  return migrated;
}

// ---------------------------------------------------------------------------
// 2. ANALYSIS REPORTS HISTORY (/analysis_reports/{reportId})
// ---------------------------------------------------------------------------
export async function saveAnalysisReport(input: {
  symbol: string;
  timeframe: string;
  tradingStyle: TradingStyle;
  analysis: Record<string, any>;
}): Promise<SavedAnalysisReport> {
  const id = generateValidDocId();
  const created_at = new Date().toISOString();
  const ts = input.analysis?.tradeSetup || {};
  const entry = safeNonNegNumber(ts.entry ?? input.analysis?.optimalEntry, 0);
  const stopLoss = safeNonNegNumber(ts.stopLoss ?? input.analysis?.stopLoss, 0);
  const tp1 = safeNonNegNumber(
    Array.isArray(ts.takeProfits) ? ts.takeProfits[0] : input.analysis?.takeProfit1,
    0
  );
  const confluenceScorePct = Math.max(
    0,
    Math.min(100, Number(input.analysis?.confluenceScorePct ?? 65) || 65)
  );
  const summary = clampStr(
    input.analysis?.summary || input.analysis?.marketStructure || "Completed setup scan",
    2000
  );
  const riskReward = clampStr(ts.riskRewardRatio || input.analysis?.riskRewardRatio || "1:2", 32);
  const bias = clampStr(input.analysis?.bias || "NEUTRAL", 32, "NEUTRAL") || "NEUTRAL";
  const sanitizedReport = sanitizeNestedObject(input.analysis, 4);

  const reportRecord: SavedAnalysisReport = {
    id,
    created_at,
    symbol: clampStr(input.symbol, 64, "UNKNOWN") || "UNKNOWN",
    timeframe: clampStr(input.timeframe, 16, "M15") || "M15",
    tradingStyle: input.tradingStyle === "SCALP" ? "SCALP" : "NORMAL",
    bias,
    confluenceScorePct,
    summary,
    entry,
    stopLoss,
    tp1,
    riskReward,
    reportData: sanitizedReport,
  };

  if (firebaseAuth.currentUser) {
    const path = `analysis_reports/${id}`;
    try {
      await setDoc(doc(firestoreDb, "analysis_reports", id), {
        userId: firebaseAuth.currentUser.uid,
        symbol: reportRecord.symbol,
        timeframe: reportRecord.timeframe,
        tradingStyle: reportRecord.tradingStyle,
        bias: reportRecord.bias,
        confluenceScorePct: reportRecord.confluenceScorePct,
        summary: reportRecord.summary,
        entry: reportRecord.entry,
        stopLoss: reportRecord.stopLoss,
        tp1: reportRecord.tp1,
        riskReward: reportRecord.riskReward,
        reportData: reportRecord.reportData,
        created_at: serverTimestamp(),
      });
      return reportRecord;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  const localReports = getLocalReports();
  localReports.unshift(reportRecord);
  localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(localReports.slice(0, 15)));
  return reportRecord;
}

export function subscribeAnalysisReports(
  callback: (reports: SavedAnalysisReport[]) => void,
  onError?: (err: any) => void
): () => void {
  if (firebaseAuth.currentUser) {
    const path = "analysis_reports";
    const q = query(
      collection(firestoreDb, "analysis_reports"),
      where("userId", "==", firebaseAuth.currentUser.uid)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: SavedAnalysisReport[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            created_at: toIsoTimestamp(d.created_at),
            symbol: d.symbol || "",
            timeframe: d.timeframe || "",
            tradingStyle: d.tradingStyle === "SCALP" ? "SCALP" : "NORMAL",
            bias: d.bias || "NEUTRAL",
            confluenceScorePct: Number(d.confluenceScorePct) || 0,
            summary: d.summary || "",
            entry: Number(d.entry) || 0,
            stopLoss: Number(d.stopLoss) || 0,
            tp1: Number(d.tp1) || 0,
            riskReward: d.riskReward || "",
            reportData: d.reportData || undefined,
          });
        });
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        callback(list.slice(0, 20));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, path);
        } catch (structuredErr) {
          onError?.(structuredErr);
        }
      }
    );
  }

  callback(getLocalReports());
  return () => {};
}

export async function deleteAnalysisReport(id: string): Promise<boolean> {
  if (firebaseAuth.currentUser) {
    const path = `analysis_reports/${id}`;
    try {
      await deleteDoc(doc(firestoreDb, "analysis_reports", id));
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
  const filtered = getLocalReports().filter((r) => r.id !== id);
  localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(filtered));
  return true;
}

// ---------------------------------------------------------------------------
// 3. USER PREFERENCES (/user_preferences/{userId})
// ---------------------------------------------------------------------------
export async function getUserPreferences(): Promise<UserPreferences | null> {
  if (!firebaseAuth.currentUser) return null;
  const uid = firebaseAuth.currentUser.uid;
  const path = `user_preferences/${uid}`;
  try {
    const snap = await getDoc(doc(firestoreDb, "user_preferences", uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      tradingStyle: d.tradingStyle === "SCALP" ? "SCALP" : "NORMAL",
      defaultSymbol: d.defaultSymbol || "EURUSD",
      defaultTimeframe: d.defaultTimeframe || "M15",
      accountBalance: d.accountBalance !== undefined && d.accountBalance !== null ? Number(d.accountBalance) : undefined,
      riskPercent: d.riskPercent !== undefined && d.riskPercent !== null ? Number(d.riskPercent) : undefined,
      updated_at: toIsoTimestamp(d.updated_at),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  if (!firebaseAuth.currentUser) return;
  const uid = firebaseAuth.currentUser.uid;
  const path = `user_preferences/${uid}`;
  try {
    await setDoc(doc(firestoreDb, "user_preferences", uid), {
      userId: uid,
      tradingStyle: prefs.tradingStyle === "SCALP" ? "SCALP" : "NORMAL",
      defaultSymbol: clampStr(prefs.defaultSymbol, 64, "EURUSD") || "EURUSD",
      defaultTimeframe: clampStr(prefs.defaultTimeframe, 16, "M15") || "M15",
      accountBalance:
        prefs.accountBalance !== undefined && Number.isFinite(Number(prefs.accountBalance))
          ? Math.max(0, Math.min(1000000000, Number(prefs.accountBalance)))
          : null,
      riskPercent:
        prefs.riskPercent !== undefined && Number.isFinite(Number(prefs.riskPercent))
          ? Math.max(0.05, Math.min(25, Number(prefs.riskPercent)))
          : null,
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Local storage helpers
function getLocalTrades(): Trade[] {
  try {
    const raw = localStorage.getItem(LOCAL_TRADES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getLocalReports(): SavedAnalysisReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
