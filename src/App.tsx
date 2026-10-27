import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  CircleDollarSign,
  BookOpen,
  Settings,
  Upload,
  Loader2,
  Trash2,
  CheckCircle,
  TrendingUp,
  AlertCircle,
  Check,
  ShieldCheck,
  ChevronDown,
  Info,
  Play,
  FileDown,
  Paintbrush,
  MessageSquare,
  Sparkles,
  Activity,
  Download,
  Code,
  ArrowLeft,
  Search,
} from "lucide-react";
import { SYNTHETIC_SYMBOLS, SyntheticSymbol, MarketClassType } from "./data/symbols";
import {
  Trade,
  saveTrade,
  deleteTrade,
  updateTradeStatus,
  updateTradeNotes,
  subscribeTrades,
} from "./lib/db";
import { exportTradeToPDF } from "./lib/pdfExport";
import RiskCalculator from "./components/RiskCalculator";
import DatabaseSetup from "./components/DatabaseSetup";
import InteractiveCanvas from "./components/InteractiveCanvas";
import ChatSidebar from "./components/ChatSidebar";
import TradeSettlementForm from "./components/TradeSettlementForm";
import PnlGrowthChart from "./components/PnlGrowthChart";
import QuickNoteModal from "./components/QuickNoteModal";
import LiveTradingViewChart from "./components/LiveTradingViewChart";
import PineScriptGenerator from "./components/PineScriptGenerator";
import { LandingPage } from "./components/LandingPage";
import { PWAInstallBanner } from "./components/PWAInstallBanner";
import { QuantAnalyzerPanel } from "./components/QuantAnalyzerPanel";
import { cacheChartStateToSW } from "./lib/usePWAInstall";
import { auth as firebaseAuth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserLearnings } from "./lib/firebaseChat";
import { useMarketData } from "./hooks/useMarketData";
import { formatPrice } from "./lib/quantEngine";
import { StandardCandle } from "./services/MarketDataService";

const compressImage = async (
  dataUrl: string,
  maxWidth = 1000,
  quality = 0.5
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

function generateLiveChartSnapshot(
  candles: StandardCandle[],
  symbol: SyntheticSymbol,
  timeframe: string
): string {
  if (typeof document === "undefined") return "";
  const width = 1200;
  const height = 700;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Institutional Dark Slate background
  ctx.fillStyle = "#0B0E14";
  ctx.fillRect(0, 0, width, height);

  // Take the last 60-75 candles or generate synthetic seeds
  let displayCandles = candles && candles.length > 0 ? candles.slice(-70) : [];
  if (displayCandles.length < 10) {
    let p = symbol.defaultPrice || 1.085;
    const atr = symbol.atrDefault || p * 0.015;
    displayCandles = [];
    const now = Math.floor(Date.now() / 1000);
    for (let i = 55; i >= 0; i--) {
      const delta = (Math.random() - 0.49) * atr;
      const open = p;
      const close = p + delta;
      const high = Math.max(open, close) + Math.random() * (atr * 0.4);
      const low = Math.min(open, close) - Math.random() * (atr * 0.4);
      displayCandles.push({
        timestamp: now - i * 3600,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 450) + 80,
        isClosed: true,
      });
      p = close;
    }
  }

  // Calculate price boundaries
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const c of displayCandles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  }
  const padding = (maxPrice - minPrice) * 0.08 || minPrice * 0.01;
  minPrice -= padding;
  maxPrice += padding;
  const priceRange = maxPrice - minPrice || 1;

  // Chart coordinates
  const chartLeft = 50;
  const chartRight = width - 110;
  const chartTop = 70;
  const chartBottom = height - 55;
  const chartHeight = chartBottom - chartTop;
  const chartWidth = chartRight - chartLeft;

  // Draw Gridlines & Price Scales
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const y = chartTop + (chartHeight / 6) * i;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();

    const p = maxPrice - (priceRange / 6) * i;
    ctx.fillStyle = "#64748B";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(formatPrice(p, symbol), chartRight + 12, y + 4);
  }

  // Watermark
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.font = "bold 56px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${symbol.ticker} · ${timeframe}`, chartWidth / 2 + chartLeft, height / 2);

  // Top header text
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "bold 20px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${symbol.name} (${symbol.ticker})`, chartLeft, 40);

  ctx.font = "13px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#10B981";
  const lastC = displayCandles[displayCandles.length - 1];
  ctx.fillText(`LATEST: ${formatPrice(lastC.close, symbol)}  TF: ${timeframe}`, chartLeft + 360, 40);

  // Draw Candlesticks & Wicks
  const candleCount = displayCandles.length;
  const slotWidth = chartWidth / candleCount;
  const candleWidth = Math.max(3, slotWidth * 0.72);

  const getY = (val: number) => chartBottom - ((val - minPrice) / priceRange) * chartHeight;

  displayCandles.forEach((c, idx) => {
    const x = chartLeft + idx * slotWidth + slotWidth / 2;
    const isBull = c.close >= c.open;
    const bodyColor = isBull ? "#10B981" : "#F43F5E";
    const wickColor = isBull ? "#059669" : "#E11D48";

    // Wick
    ctx.strokeStyle = wickColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, getY(c.high));
    ctx.lineTo(x, getY(c.low));
    ctx.stroke();

    // Body
    const yOpen = getY(c.open);
    const yClose = getY(c.close);
    const bodyTop = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
  });

  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<"landing" | "dashboard">(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/dashboard") ||
        window.location.hash === "#dashboard")
    ) {
      return "dashboard";
    }
    return "landing";
  });
  const [activeTab, setActiveTab] = useState<
    "analyzer" | "calculator" | "journal" | "databases"
  >("analyzer");
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

  // Selection state
  const [marketClassFilter, setMarketClassFilter] = useState<
    "ALL" | MarketClassType
  >("ALL");
  const [symbol, setSymbol] = useState<SyntheticSymbol>(SYNTHETIC_SYMBOLS[0]);
  const [timeframe, setTimeframe] = useState<string>("H1");
  const [customSymbolText, setCustomSymbolText] = useState("");
  const [symbolSearchQuery, setSymbolSearchQuery] = useState("");

  // Live Multi-Provider WebSocket Ingestion (Bybit Linear V5 + Deriv Public WS)
  const { candles, latestCandle, futuresTelemetry, telemetry } = useMarketData(symbol, timeframe);

  const navigateToDashboard = () => {
    setCurrentRoute("dashboard");
    try {
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/dashboard"
      ) {
        window.history.pushState({ route: "dashboard" }, "", "/dashboard");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Fallback for restricted iframe history contexts
    }
  };

  const navigateToLanding = () => {
    setCurrentRoute("landing");
    try {
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.history.pushState({ route: "landing" }, "", "/");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Fallback for restricted iframe history contexts
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (
        window.location.pathname.startsWith("/dashboard") ||
        window.location.hash === "#dashboard"
      ) {
        setCurrentRoute("dashboard");
      } else {
        setCurrentRoute("landing");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    cacheChartStateToSW({
      ticker: symbol.ticker,
      timeframe,
      route: currentRoute,
      updatedAt: Date.now(),
    });
  }, [symbol, timeframe, currentRoute]);

  // Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-Timeframe Strategy States
  const [isMtfMode, setIsMtfMode] = useState<boolean>(false);
  const [selectedMtfView, setSelectedMtfView] = useState<"m30" | "h4" | "d1">(
    "m30"
  );
  const [mtfImages, setMtfImages] = useState<{
    m30: { file: File | null; preview: string | null; original: string | null };
    h4: { file: File | null; preview: string | null; original: string | null };
    d1: { file: File | null; preview: string | null; original: string | null };
  }>({
    m30: { file: null, preview: null, original: null },
    h4: { file: null, preview: null, original: null },
    d1: { file: null, preview: null, original: null },
  });

  // Analysis result state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analyzerSubTab, setAnalyzerSubTab] = useState<
    "quant_engine" | "analysis" | "drawing" | "live_feed" | "pine_script"
  >("quant_engine");
  const [activeLevels, setActiveLevels] = useState<{
    entry: number;
    stopLoss: number;
    tp1: number;
    tp2: number;
  }>({
    entry: 0,
    stopLoss: 0,
    tp1: 0,
    tp2: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Save/Journaling metadata additions
  const [isSaving, setIsSaving] = useState(false);
  const [tradeNotes, setTradeNotes] = useState("");
  const [journalSaveStatus, setJournalSaveStatus] = useState<
    "idle" | "saved" | "error"
  >("idle");
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  // Journal Trades state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [journalFilter, setJournalFilter] = useState<
    "ALL" | "PENDING" | "WON" | "LOST" | "BREAKEAVEN"
  >("ALL");
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [dbConfigUpdated, setDbConfigUpdated] = useState(0);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState<boolean>(false);

  const handleExportPDF = async (trade: Trade) => {
    setExportingId(trade.id);
    try {
      await exportTradeToPDF(trade);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setExportingId(null);
    }
  };

  const handleQuickNoteSave = async (
    tradeId: string,
    notes: string
  ): Promise<boolean> => {
    try {
      const success = await updateTradeNotes(tradeId, notes);
      if (success) {
        setDbConfigUpdated((prev) => prev + 1);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to save quick notes:", err);
      return false;
    }
  };

  const handleExportSMCJson = () => {
    if (!analysisResult) return;

    const exportData = {
      symbol: customSymbolText || symbol.name,
      ticker: symbol.ticker,
      exportedAt: new Date().toISOString(),
      orderBlock: {
        priceRange: analysisResult.orderBlock?.priceRange || "N/A",
        type: analysisResult.orderBlock?.type || "N/A",
        rationale: analysisResult.orderBlock?.rationale || "N/A",
      },
      supplyDemandZones: {
        supply: analysisResult.supplyDemandZones?.supply || "N/A",
        demand: analysisResult.supplyDemandZones?.demand || "N/A",
        activeZone:
          analysisResult.supplyDemandZones?.activeZone || "Equilibrium",
      },
      fibonacciRetracement: {
        level_50: analysisResult.fibonacciRetracement?.level_50 || null,
        level_618: analysisResult.fibonacciRetracement?.level_618 || null,
        level_786: analysisResult.fibonacciRetracement?.level_786 || null,
        description:
          analysisResult.fibonacciRetracement?.description ||
          "No specific retracement alignments specified.",
      },
    };

    try {
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", url);
      const fileName = `${(customSymbolText || symbol.name).replace(
        /\s+/g,
        "_"
      )}_SMC_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      downloadAnchor.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();

      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download SMC levels", e);
    }
  };

  const loadingPhrases = [
    "Receiving chart matrix...",
    "Scanning visual markers and price axes...",
    "Sweeping market structure for micro-CHoCH & BOS...",
    "Locking major high-probability Order Blocks...",
    "Calculating Supply & Demand imbalance thresholds...",
    "Mapping fibonacci retracements on current swing leg...",
    "Establishing invalidation Stop Loss levels...",
    "Formulating optimal Risk-Reward parameters...",
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user);
      setDbConfigUpdated((prev) => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (analysisResult?.tradeSetup) {
      const ts = analysisResult.tradeSetup;
      setActiveLevels({
        entry: Number(ts.entry) || 0,
        stopLoss: Number(ts.stopLoss) || 0,
        tp1:
          ts.takeProfits && Array.isArray(ts.takeProfits)
            ? Number(ts.takeProfits[0]) || 0
            : 0,
        tp2:
          ts.takeProfits && Array.isArray(ts.takeProfits)
            ? Number(ts.takeProfits[1]) || 0
            : 0,
      });
    }
  }, [analysisResult]);

  useEffect(() => {
    const unsubscribe = subscribeTrades(
      (list) => {
        setTrades(list);
      },
      (err) => {
        console.error("Sync journal logs failure:", err);
      }
    );
    return () => unsubscribe();
  }, [dbConfigUpdated, activeTab]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage(
        "Unsupported file. You must upload a chart screenshot image (PNG, JPG, WEBP)."
      );
      return;
    }
    setImageFile(file);
    setErrorMessage("");
    setJournalSaveStatus("idle");

    const reader = new FileReader();
    reader.onload = (e) => {
      const resultStr = e.target?.result as string;
      setImagePreview(resultStr);
      setOriginalImage(resultStr);
      setAnalysisResult(null);
      setAnalyzerSubTab("drawing");
    };
    reader.readAsDataURL(file);
  };

  const processMtfFile = (file: File, key: "m30" | "h4" | "d1") => {
    if (!file.type.startsWith("image/")) {
      setErrorMessage(
        "Unsupported file. Please upload a valid image (PNG/JPG/WEBP)."
      );
      return;
    }
    setErrorMessage("");
    setJournalSaveStatus("idle");

    const reader = new FileReader();
    reader.onload = (e) => {
      const resultStr = e.target?.result as string;
      setMtfImages((prev) => ({
        ...prev,
        [key]: {
          file: file,
          preview: resultStr,
          original: resultStr,
        },
      }));

      if (key === "m30") {
        setImageFile(file);
        setImagePreview(resultStr);
        setOriginalImage(resultStr);
      }
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  };

  const triggerSearchFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const startSMCAnalysis = async (overrideImage?: string) => {
    let targetImage = overrideImage || imagePreview;

    if (isMtfMode) {
      if (
        !mtfImages.m30.preview ||
        !mtfImages.h4.preview ||
        !mtfImages.d1.preview
      ) {
        // Auto-generate top-down snapshots across 30M, 4H, and 1D if not manually uploaded
        const snap30m = generateLiveChartSnapshot(candles, symbol, "30M");
        const snap4h = generateLiveChartSnapshot(candles, symbol, "4H");
        const snap1d = generateLiveChartSnapshot(candles, symbol, "1D");
        setMtfImages({
          m30: { file: null, preview: snap30m, original: snap30m },
          h4: { file: null, preview: snap4h, original: snap4h },
          d1: { file: null, preview: snap1d, original: snap1d },
        });
        targetImage = snap30m;
        setImagePreview(snap30m);
        setOriginalImage(snap30m);
      }
    } else {
      if (!targetImage) {
        // Auto-capture live high-resolution candlestick chart matrix directly from market candles
        const autoSnap = generateLiveChartSnapshot(candles, symbol, timeframe);
        targetImage = autoSnap;
        setImagePreview(autoSnap);
        setOriginalImage(autoSnap);
      }
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setAnalysisResult(null);
    setJournalSaveStatus("idle");

    let phraseIdx = 0;
    setAnalysisProgress(loadingPhrases[0]);
    const phraseInterval = setInterval(() => {
      phraseIdx = (phraseIdx + 1) % loadingPhrases.length;
      setAnalysisProgress(loadingPhrases[phraseIdx]);
    }, 1200);

    try {
      let learningsData: any[] = [];
      try {
        learningsData = await getUserLearnings();
      } catch (le) {
        console.warn(
          "Could not fetch user learnings for reinforcement learning:",
          le
        );
      }

      let currentPrice: number | null = null;
      try {
        currentPrice = await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Deriv API Timeout")),
            2500
          );
          const derivAppId =
            (import.meta as any).env?.VITE_DERIV_APP_ID || "1089";
          const ws = new WebSocket(
            `wss://ws.binaryws.com/websockets/v3?app_id=${derivAppId}`
          );

          ws.onopen = () => {
            const tk = symbol.ticker;
            const derivSymbol =
              tk === "V10"
                ? "R_10"
                : tk === "V25"
                  ? "R_25"
                  : tk === "V50"
                    ? "R_50"
                    : tk === "V75"
                      ? "R_75"
                      : tk === "V100"
                        ? "R_100"
                        : tk === "B1000"
                          ? "BOOM1000"
                          : tk === "B500"
                            ? "BOOM500"
                            : tk === "C1000"
                              ? "CRASH1000"
                              : tk === "C500"
                                ? "CRASH500"
                                : tk === "STEP"
                                  ? "STPRNG"
                                  : tk === "J100"
                                    ? "JD100"
                                    : "R_75";
            ws.send(JSON.stringify({ ticks: derivSymbol }));
          };
          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.error) {
              reject(new Error(data.error.message));
            } else if (data.tick && data.tick.quote) {
              clearTimeout(timeout);
              ws.close();
              resolve(Number(data.tick.quote));
            }
          };
          ws.onerror = (err) => {
            clearTimeout(timeout);
            reject(err);
          };
        });
      } catch (e) {
        console.warn("Could not fetch live Deriv market data:", e);
      }

      let compressedImages: string[] = [];
      let compressedTargetImage = targetImage;

      if (isMtfMode) {
        compressedImages = await Promise.all([
          compressImage(mtfImages.m30.preview!),
          compressImage(mtfImages.h4.preview!),
          compressImage(mtfImages.d1.preview!),
        ]);
      } else if (targetImage) {
        compressedTargetImage = await compressImage(targetImage);
      }

      const requestBody = isMtfMode
        ? {
            images: compressedImages,
            symbol: customSymbolText ? customSymbolText : symbol.name,
            timeframe: "30M",
            tradeHistory: trades,
            learnings: learningsData,
            currentPrice: currentPrice,
          }
        : {
            image: compressedTargetImage,
            symbol: customSymbolText ? customSymbolText : symbol.name,
            timeframe: timeframe,
            tradeHistory: trades,
            learnings: learningsData,
            currentPrice: currentPrice,
          };

      const response = await fetch(`/api/analyze-chart?_t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify(requestBody),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Server returned a non-JSON response (Status ${response.status}). Ensure the server environment variables are configured.`
        );
      }
      const parsed = await response.json();
      clearInterval(phraseInterval);

      if (!response.ok || !parsed.success) {
        throw new Error(
          parsed.error
            ? typeof parsed.error === "string"
              ? parsed.error
              : JSON.stringify(parsed.error)
            : parsed.message
              ? parsed.message
              : `Execution failed: ${JSON.stringify(parsed)}`
        );
      }

      setAnalysisResult(parsed.data);
      setAnalyzerSubTab("analysis");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message ||
          "Network timeout or server configuration error. Please try again."
      );
    } finally {
      clearInterval(phraseInterval);
      setIsAnalyzing(false);
    }
  };

  const saveToJournal = async () => {
    if (!analysisResult) return;
    setIsSaving(true);
    setJournalSaveStatus("idle");

    try {
      const dbPayload = {
        symbol: customSymbolText ? customSymbolText : symbol.ticker,
        timeframe: timeframe,
        bias: analysisResult.bias,
        entry_price: Number(analysisResult.tradeSetup.entry) || 0.0,
        stop_loss: Number(analysisResult.tradeSetup.stopLoss) || 0.0,
        take_profit: Number(analysisResult.tradeSetup.takeProfits[0]) || 0.0,
        risk_reward: analysisResult.tradeSetup.riskRewardRatio || "1:2",
        image_url: imagePreview || "",
        notes:
          tradeNotes.trim() ||
          `Automated target strategy for ${symbol.ticker} at ${timeframe}`,
        status: "PENDING" as const,
        analysis_info: {
          marketStructure: analysisResult.marketStructure,
          orderBlock: analysisResult.orderBlock,
          supplyDemandZones: analysisResult.supplyDemandZones,
          fibonacciRetracement: analysisResult.fibonacciRetracement,
          tradeSetup: analysisResult.tradeSetup,
          educationalInsight: analysisResult.educationalInsight,
        },
      };

      await saveTrade(dbPayload);
      setJournalSaveStatus("saved");
      setTradeNotes("");
      setDbConfigUpdated((prev) => prev + 1);
    } catch (err) {
      console.error("Journal logging crash:", err);
      setJournalSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    state: "WON" | "LOST" | "BREAKEAVEN" | "PENDING"
  ) => {
    try {
      await updateTradeStatus(id, state);
      setDbConfigUpdated((prev) => prev + 1);
    } catch (err) {
      console.error("Could not override trade results state", err);
    }
  };

  const handleDeleteTrade = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTrade(id);
      setDbConfigUpdated((prev) => prev + 1);
    } catch (err) {
      console.error("Erase journal target failed:", err);
    }
  };

  // Filtered journal list
  const filteredTrades = trades.filter((t) =>
    journalFilter === "ALL" ? true : t.status === journalFilter
  );

  // Statistics
  const totalTrades = trades.length;
  const wonTrades = trades.filter((t) => t.status === "WON").length;
  const lostTrades = trades.filter((t) => t.status === "LOST").length;
  const winRate =
    wonTrades + lostTrades > 0
      ? Math.round((wonTrades / (wonTrades + lostTrades)) * 100)
      : 0;

  // Render Frictionless Landing Page when route is "landing"
  if (currentRoute === "landing") {
    return (
      <>
        <PWAInstallBanner />
        <LandingPage
          onLaunchDashboard={navigateToDashboard}
          onSelectAssetAndLaunch={(selectedSym) => {
            setSymbol(selectedSym);
            setMarketClassFilter(selectedSym.marketType);
            navigateToDashboard();
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-600 selection:text-white">
      <PWAInstallBanner />

      {/* INSTITUTIONAL TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={navigateToLanding}
              title="Back to Landing Page"
              className="flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-sm group-hover:bg-emerald-700 transition-colors">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-base tracking-tight text-slate-900">
                    Quant<span className="text-emerald-600">SMC</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    v4.2 Institutional
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Multi-Asset Quantitative Workstation · Forex · Synthetics · Perps
                </p>
              </div>
            </button>
          </div>

          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab("analyzer")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "analyzer"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <LineChart className="h-3.5 w-3.5" />
              <span>Quant Terminal</span>
            </button>
            <button
              onClick={() => setActiveTab("calculator")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "calculator"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <CircleDollarSign className="h-3.5 w-3.5" />
              <span>Risk Sizing</span>
            </button>
            <button
              onClick={() => setActiveTab("journal")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "journal"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Trade Journal</span>
              {trades.length > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                    activeTab === "journal"
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {trades.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("databases")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "databases"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Cloud Sync</span>
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={navigateToLanding}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Overview</span>
            </button>
            <button
              onClick={() => setChatSidebarOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">SMC Mentor</span>
            </button>
          </div>
        </div>
      </header>

      {/* LIVE MARKET INGESTION TELEMETRY STRIP */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>{telemetry.provider}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Latency: <strong className="text-slate-800">{telemetry.latencyMs}ms</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-[11px] font-mono text-slate-600 hidden sm:inline">
              Ticker: <strong className="text-slate-900">{symbol.ticker} ({timeframe})</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-[11px] font-mono text-slate-600">
              Spot: <strong className="text-emerald-700">{latestCandle ? formatPrice(latestCandle.close, symbol) : formatPrice(symbol.defaultPrice, symbol)}</strong>
            </span>
          </div>

          {symbol.marketType === "CRYPTO_PERP" && (futuresTelemetry || symbol.futuresMetrics) && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                FR: {futuresTelemetry ? `${(futuresTelemetry.fundingRate * 100).toFixed(4)}%` : symbol.futuresMetrics?.fundingRate}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-semibold hidden md:inline">
                OI: {futuresTelemetry && futuresTelemetry.openInterestValue > 0 ? `$${(futuresTelemetry.openInterestValue / 1e9).toFixed(2)}B` : symbol.futuresMetrics?.openInterestUsd}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* MAIN WORKSPACE CONTENT */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ==========================================
            TAB 1: MULTI-ASSET QUANT TERMINAL
        ========================================== */}
        {activeTab === "analyzer" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT SIDEBAR: INSTRUMENT & VISION SCANNER */}
            <div className="lg:col-span-4 space-y-5">
              {/* 1. Instrument & Timeframe Configuration */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                    1. Instrument Selection
                  </h2>
                  <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {symbol.ticker}
                  </span>
                </div>

                {/* Market Class Segmented Control */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Asset Class Filter
                  </label>
                  <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {(
                      [
                        { id: "ALL", label: "All" },
                        { id: "FOREX", label: "Forex" },
                        { id: "SYNTHETIC", label: "Synthetics" },
                        { id: "CRYPTO_PERP", label: "Perps" },
                      ] as const
                    ).map((mc) => (
                      <button
                        key={mc.id}
                        type="button"
                        onClick={() => {
                          setMarketClassFilter(mc.id);
                          const firstMatch =
                            mc.id === "ALL"
                              ? SYNTHETIC_SYMBOLS[0]
                              : SYNTHETIC_SYMBOLS.find(
                                  (s) => s.marketType === mc.id
                                );
                          if (firstMatch) setSymbol(firstMatch);
                        }}
                        className={`py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                          marketClassFilter === mc.id
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {mc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Symbol Selector with Instant Search */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                      Select Instrument
                    </label>
                    <span className="text-[10px] font-mono text-slate-400 font-semibold">
                      {SYNTHETIC_SYMBOLS.filter((s) => {
                        const inClass = marketClassFilter === "ALL" || s.marketType === marketClassFilter;
                        if (!inClass) return false;
                        if (!symbolSearchQuery.trim()) return true;
                        const q = symbolSearchQuery.toLowerCase().trim();
                        return (
                          s.ticker.toLowerCase().includes(q) ||
                          s.name.toLowerCase().includes(q) ||
                          (s.subCategory && s.subCategory.toLowerCase().includes(q)) ||
                          s.category.toLowerCase().includes(q)
                        );
                      }).length} of {SYNTHETIC_SYMBOLS.length} markets
                    </span>
                  </div>

                  {/* Instant Search Bar */}
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={symbolSearchQuery}
                      onChange={(e) => setSymbolSearchQuery(e.target.value)}
                      placeholder="Search ticker, pair, or index (e.g. BTC, V75, Gold, EUR)..."
                      className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white rounded-lg pl-8 pr-7 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors font-medium"
                    />
                    {symbolSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSymbolSearchQuery("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Dropdown Selector */}
                  <div className="relative">
                    <select
                      value={symbol.ticker}
                      onChange={(e) => {
                        const found = SYNTHETIC_SYMBOLS.find(
                          (s) => s.ticker === e.target.value
                        );
                        if (found) {
                          setSymbol(found);
                          setCustomSymbolText("");
                        }
                      }}
                      className="w-full appearance-none bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white rounded-lg px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none transition-colors pr-9"
                    >
                      {(marketClassFilter === "ALL" ||
                        marketClassFilter === "FOREX") && (
                        <optgroup label="Standard Forex Pairs & Metals">
                          {SYNTHETIC_SYMBOLS.filter((s) => {
                            if (s.marketType !== "FOREX") return false;
                            if (!symbolSearchQuery.trim()) return true;
                            const q = symbolSearchQuery.toLowerCase().trim();
                            return (
                              s.ticker.toLowerCase().includes(q) ||
                              s.name.toLowerCase().includes(q) ||
                              (s.subCategory && s.subCategory.toLowerCase().includes(q)) ||
                              s.category.toLowerCase().includes(q)
                            );
                          }).map((s) => (
                            <option key={s.ticker} value={s.ticker}>
                              {s.name} ({s.ticker}) — {s.subCategory || s.category}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {(marketClassFilter === "ALL" ||
                        marketClassFilter === "SYNTHETIC") && (
                        <optgroup label="24/7 Synthetic Indices">
                          {SYNTHETIC_SYMBOLS.filter((s) => {
                            if (s.marketType !== "SYNTHETIC") return false;
                            if (!symbolSearchQuery.trim()) return true;
                            const q = symbolSearchQuery.toLowerCase().trim();
                            return (
                              s.ticker.toLowerCase().includes(q) ||
                              s.name.toLowerCase().includes(q) ||
                              (s.subCategory && s.subCategory.toLowerCase().includes(q)) ||
                              s.category.toLowerCase().includes(q)
                            );
                          }).map((s) => (
                            <option key={s.ticker} value={s.ticker}>
                              {s.name} ({s.ticker}) — {s.category}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {(marketClassFilter === "ALL" ||
                        marketClassFilter === "CRYPTO_PERP") && (
                        <optgroup label="Crypto Perpetuals (Bybit / Binance)">
                          {SYNTHETIC_SYMBOLS.filter((s) => {
                            if (s.marketType !== "CRYPTO_PERP") return false;
                            if (!symbolSearchQuery.trim()) return true;
                            const q = symbolSearchQuery.toLowerCase().trim();
                            return (
                              s.ticker.toLowerCase().includes(q) ||
                              s.name.toLowerCase().includes(q) ||
                              (s.subCategory && s.subCategory.toLowerCase().includes(q)) ||
                              s.category.toLowerCase().includes(q)
                            );
                          }).map((s) => (
                            <option key={s.ticker} value={s.ticker}>
                              {s.name} ({s.ticker})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <ChevronDown className="h-4 w-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Custom Instrument Override */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Custom Ticker Override (Optional)
                  </label>
                  <input
                    type="text"
                    value={customSymbolText}
                    onChange={(e) => setCustomSymbolText(e.target.value)}
                    placeholder="e.g., NAS100, US30, USD/CAD..."
                    className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors"
                  />
                </div>

                {/* Primary Timeframe */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                    Execution Timeframe
                  </label>
                  <div className="grid grid-cols-6 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    {["M1", "M5", "M15", "M30", "H1", "H4"].map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => setTimeframe(tf)}
                        className={`py-1.5 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                          timeframe === tf
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instrument Profile Summary */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">
                      Instrument Category
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-emerald-700">
                      {symbol.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {symbol.description}
                  </p>
                </div>
              </div>

              {/* 2. AI Chart Screenshot Scanner */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                    2. AI Vision Chart Scanner
                  </h2>
                  <span className="text-[10px] font-mono text-slate-500">
                    Optional Screenshot Input
                  </span>
                </div>

                {/* Mode Switcher */}
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsMtfMode(false)}
                    className={`py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      !isMtfMode
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Single Timeframe
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMtfMode(true)}
                    className={`py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      isMtfMode
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Top-Down (30M/4H/1D)
                  </button>
                </div>

                {!isMtfMode ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerSearchFile}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                      dragActive
                        ? "border-emerald-600 bg-emerald-50/50"
                        : imagePreview
                          ? "border-emerald-300 bg-slate-50"
                          : "border-slate-300 hover:border-emerald-500 bg-slate-50/60"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {imagePreview ? (
                      <div className="space-y-3">
                        <div className="relative rounded-lg overflow-hidden border border-slate-200 max-h-44 mx-auto">
                          <img
                            src={imagePreview}
                            alt="Uploaded Chart"
                            className="w-full h-44 object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs text-emerald-700 font-semibold">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                          <span>Chart Loaded — Click to Replace</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 space-y-2">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                          <Upload className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-800">
                          Drop TradingView / MT5 Screenshot
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Supports PNG, JPG, WEBP up to 10MB
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(
                      [
                        {
                          key: "d1",
                          label: "1D Macro Bias",
                          desc: "Daily directional bias & major liquidity",
                        },
                        {
                          key: "h4",
                          label: "4H Structural Zone",
                          desc: "Intermediate Order Blocks & FVG zones",
                        },
                        {
                          key: "m30",
                          label: "30M Entry Trigger",
                          desc: "LTF CHoCH, sweep & execution sniper",
                        },
                      ] as const
                    ).map((slot) => {
                      const slotData = mtfImages[slot.key];
                      return (
                        <div
                          key={slot.key}
                          className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
                            slotData.preview
                              ? "bg-emerald-50/40 border-emerald-300"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {slotData.preview ? (
                              <img
                                src={slotData.preview}
                                alt={slot.label}
                                className="h-10 w-14 object-cover rounded border border-slate-300"
                              />
                            ) : (
                              <div className="h-10 w-14 rounded bg-white border border-slate-200 flex items-center justify-center text-[10px] font-mono font-bold text-slate-500">
                                {slot.key.toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {slot.label}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {slot.desc}
                              </p>
                            </div>
                          </div>
                          <label className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-semibold cursor-pointer transition-colors">
                            {slotData.preview ? "Change" : "Upload"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  processMtfFile(e.target.files[0], slot.key);
                                }
                              }}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">Scanner Alert</p>
                      <p className="text-[11px] text-red-700 leading-relaxed">
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => startSMCAnalysis()}
                  disabled={isAnalyzing}
                  className="w-full py-3.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Scanning Chart Matrix &amp; Order Blocks...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      <span>{imagePreview ? "Run AI Vision SMC Analysis" : `Analyze ${symbol.ticker} (Instant 1-Click Scan)`}</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-slate-500 font-medium">
                  {imagePreview
                    ? "Custom chart screenshot loaded and ready for deep institutional scan"
                    : "Zero setup required — instant auto-scan of live market candles"}
                </p>
              </div>
            </div>

            {/* RIGHT MAIN WORKSPACE: 5-MODULE QUANT ENGINE, LIVE TERMINAL, PINE SCRIPT & VISION */}
            <div className="lg:col-span-8 space-y-5">
              {/* Workspace Mode Navigation */}
              <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap items-center gap-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("quant_engine")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    analyzerSubTab === "quant_engine"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>5-Module Quant Engine</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("live_feed")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    analyzerSubTab === "live_feed"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Live Deriv Stream</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("pine_script")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    analyzerSubTab === "pine_script"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Code className="h-3.5 w-3.5" />
                  <span>Pine Script v5</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("analysis")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    analyzerSubTab === "analysis"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Vision Output</span>
                </button>

                {(imagePreview || isMtfMode) && (
                  <button
                    type="button"
                    onClick={() => setAnalyzerSubTab("drawing")}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      analyzerSubTab === "drawing"
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Paintbrush className="h-3.5 w-3.5" />
                    <span>Chart Markup</span>
                  </button>
                )}
              </div>

              {/* SUB-TAB 1: 5-MODULE QUANTITATIVE ENGINE */}
              {analyzerSubTab === "quant_engine" && (
                <QuantAnalyzerPanel
                  symbol={symbol}
                  timeframe={timeframe}
                  onSyncLevelsToWorkspace={(levels) => {
                    setActiveLevels({
                      entry: levels.entry,
                      stopLoss: levels.stopLoss,
                      tp1: levels.tp1,
                      tp2: levels.tp2,
                    });
                    setActiveTab("calculator");
                  }}
                />
              )}

              {/* SUB-TAB 2: LIVE TRADINGVIEW / DERIV FEED */}
              {analyzerSubTab === "live_feed" && (
                <LiveTradingViewChart
                  symbol={symbol}
                  timeframe={timeframe}
                  analysisResult={analysisResult}
                  currentWorkspaceLevels={activeLevels}
                  onSyncLevels={(levels) => setActiveLevels(levels)}
                  onCaptureScreenshot={(dataUrl) => {
                    setImagePreview(dataUrl);
                    setOriginalImage(dataUrl);
                    startSMCAnalysis(dataUrl);
                  }}
                />
              )}

              {/* SUB-TAB 3: PINE SCRIPT GENERATOR */}
              {analyzerSubTab === "pine_script" && <PineScriptGenerator />}

              {/* SUB-TAB 4: INTERACTIVE CHART MARKUP CANVAS */}
              {analyzerSubTab === "drawing" && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  {isMtfMode && (
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Select Timeframe Canvas
                      </span>
                      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        {(["d1", "h4", "m30"] as const).map((k) => (
                          <button
                            key={k}
                            onClick={() => setSelectedMtfView(k)}
                            className={`px-3 py-1 rounded text-xs font-mono font-bold uppercase cursor-pointer ${
                              selectedMtfView === k
                                ? "bg-emerald-600 text-white"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const activeImg = isMtfMode
                      ? mtfImages[selectedMtfView].original
                      : originalImage;
                    if (!activeImg) {
                      return (
                        <div className="py-12 text-center text-slate-500 text-sm">
                          Upload a chart image from the left panel to annotate
                          liquidity zones and order blocks.
                        </div>
                      );
                    }
                    return (
                      <InteractiveCanvas
                        imageUrl={activeImg}
                        analysisResult={analysisResult}
                        onSaveComposite={(annotatedDataUrl) => {
                          setImagePreview(annotatedDataUrl);
                          startSMCAnalysis(annotatedDataUrl);
                        }}
                      />
                    );
                  })()}
                </div>
              )}

              {/* SUB-TAB 5: AI VISION OUTPUT */}
              {analyzerSubTab === "analysis" && (
                <div>
                  {isAnalyzing ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
                      <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                      <h3 className="text-base font-bold font-display text-slate-900">
                        Executing Institutional Vision Scan
                      </h3>
                      <p className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 inline-block px-3 py-1.5 rounded-md">
                        {analysisProgress}
                      </p>
                    </div>
                  ) : !analysisResult ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
                      <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="max-w-md mx-auto space-y-1.5">
                        <h3 className="text-base font-bold font-display text-slate-900">
                          No Screenshot Scanned Yet
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Upload a chart screenshot on the left panel or capture
                          a snapshot directly from the{" "}
                          <button
                            type="button"
                            onClick={() => setAnalyzerSubTab("live_feed")}
                            className="text-emerald-700 font-semibold underline cursor-pointer"
                          >
                            Live Deriv Stream
                          </button>{" "}
                          to run AI computer-vision SMC structure detection.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5 relative">
                      {/* Action Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            AI Vision Matrix Output
                          </span>
                          <h2 className="text-lg font-bold font-display text-slate-900 mt-1">
                            {customSymbolText ? customSymbolText : symbol.name}{" "}
                            ({timeframe})
                          </h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleExportSMCJson}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5 text-slate-600" />
                            <span>Export JSON</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsQuickNoteOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Quick Note</span>
                          </button>
                        </div>
                      </div>

                      {/* Multi-Timeframe Breakdown */}
                      {analysisResult.multiTimeframe && (
                        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">
                            Top-Down Multi-Timeframe Alignment
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-1.5">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                                1D Macro Trend
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {analysisResult.multiTimeframe.trend1D}
                              </p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-1.5">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                                4H Structural Zone
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {
                                  analysisResult.multiTimeframe
                                    .intermediateZone4H
                                }
                              </p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-1.5">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
                                30M Entry Trigger
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {
                                  analysisResult.multiTimeframe
                                    .entryPrecision30M
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Execution Plan Card */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h3 className="text-sm font-bold font-display text-slate-900">
                            Institutional Trade Execution Plan
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-md text-xs font-mono font-bold uppercase border ${
                              analysisResult?.bias === "BULLISH"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : analysisResult?.bias === "BEARISH"
                                  ? "bg-red-50 border-red-200 text-red-700"
                                  : "bg-slate-100 border-slate-200 text-slate-700"
                            }`}
                          >
                            {analysisResult?.bias || "NEUTRAL"} BIAS
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg border-l-4 border-l-emerald-600">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                              Entry Price
                            </p>
                            <p className="text-lg font-mono font-bold text-slate-900 mt-1 tabular-nums">
                              {analysisResult?.tradeSetup?.entry?.toLocaleString(
                                undefined,
                                { minimumFractionDigits: 2 }
                              ) || "N/A"}
                            </p>
                            <p className="text-[11px] text-emerald-700 font-medium mt-1">
                              {analysisResult?.tradeSetup?.type || "LIMIT"}{" "}
                              Order
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg border-l-4 border-l-red-600">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                              Invalidation Stop Loss
                            </p>
                            <p className="text-lg font-mono font-bold text-slate-900 mt-1 tabular-nums">
                              {analysisResult?.tradeSetup?.stopLoss?.toLocaleString(
                                undefined,
                                { minimumFractionDigits: 2 }
                              ) || "N/A"}
                            </p>
                            <p className="text-[11px] text-red-600 font-medium mt-1">
                              Distance:{" "}
                              {Math.abs(
                                (analysisResult?.tradeSetup?.entry || 0) -
                                  (analysisResult?.tradeSetup?.stopLoss || 0)
                              ).toFixed(2)}{" "}
                              pts
                            </p>
                          </div>

                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg border-l-4 border-l-emerald-500">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                              Risk-to-Reward Ratio
                            </p>
                            <p className="text-lg font-mono font-bold text-slate-900 mt-1 tabular-nums">
                              {analysisResult?.tradeSetup?.riskRewardRatio ||
                                "1:3"}
                            </p>
                            <p className="text-[11px] text-slate-600 font-medium mt-1">
                              Asymmetric Target Profile
                            </p>
                          </div>
                        </div>

                        {/* Take Profit Targets */}
                        {analysisResult?.tradeSetup?.takeProfits && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {analysisResult.tradeSetup.takeProfits.map(
                              (tp: number, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200 flex items-center justify-between"
                                >
                                  <span className="text-xs font-semibold text-emerald-900">
                                    Take Profit {idx + 1}
                                  </span>
                                  <span className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
                                    {tp?.toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                          <strong className="text-slate-900 block mb-1">
                            Execution Rationale:
                          </strong>
                          {analysisResult?.tradeSetup?.rationale ||
                            "Wait for structural confirmation inside the designated POI."}
                        </div>
                      </div>

                      {/* Order Block, Supply/Demand & Fibonacci Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">
                            Institutional Order Block
                          </h4>
                          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Price Zone</span>
                              <span className="font-mono font-bold text-emerald-700">
                                {analysisResult?.orderBlock?.priceRange ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2">
                              <span className="text-slate-500">
                                Classification
                              </span>
                              <span className="font-semibold text-slate-900">
                                {analysisResult?.orderBlock?.type || "N/A"}
                              </span>
                            </div>
                            <p className="text-slate-600 pt-2 border-t border-slate-200 leading-relaxed">
                              {analysisResult?.orderBlock?.rationale || "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">
                            Supply & Demand Zones
                          </h4>
                          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                Supply Zone
                              </span>
                              <span className="font-mono font-bold text-red-600">
                                {analysisResult?.supplyDemandZones?.supply ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2">
                              <span className="text-slate-500">
                                Demand Zone
                              </span>
                              <span className="font-mono font-bold text-emerald-700">
                                {analysisResult?.supplyDemandZones?.demand ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-2">
                              <span className="text-slate-500">
                                Active Control
                              </span>
                              <span className="font-semibold text-slate-900">
                                {analysisResult?.supplyDemandZones
                                  ?.activeZone || "Equilibrium"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Save to Journal */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">
                          Log Setup to Trade Journal
                        </h4>
                        <textarea
                          value={tradeNotes}
                          onChange={(e) => setTradeNotes(e.target.value)}
                          placeholder="Add execution notes, session timing, or confluence observations..."
                          rows={2}
                          className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white rounded-lg p-3 text-xs text-slate-900 focus:outline-none"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {journalSaveStatus === "saved" && (
                              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                <Check className="h-4 w-4" /> Saved to Trade
                                Journal
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={saveToJournal}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            {isSaving ? "Saving..." : "Save Setup to Journal"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: POSITION & RISK CALCULATOR
        ========================================== */}
        {activeTab === "calculator" && (
          <div className="max-w-4xl mx-auto">
            <RiskCalculator
              selectedSymbolTicker={symbol.ticker}
              initialStopLossPoints={
                activeLevels.entry && activeLevels.stopLoss
                  ? Math.max(
                      1,
                      Math.round(
                        Math.abs(activeLevels.entry - activeLevels.stopLoss)
                      )
                    )
                  : 100
              }
            />
          </div>
        )}

        {/* ==========================================
            TAB 3: PERFORMANCE & TRADE JOURNAL
        ========================================== */}
        {activeTab === "journal" && (
          <div className="space-y-6">
            {/* KPI Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Logged Setups
                </span>
                <p className="text-2xl font-display font-bold text-slate-900 mt-1 tabular-nums">
                  {totalTrades}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Verified Win Rate
                </span>
                <p className="text-2xl font-display font-bold text-emerald-600 mt-1 tabular-nums">
                  {winRate}%
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Trades Won
                </span>
                <p className="text-2xl font-display font-bold text-emerald-700 mt-1 tabular-nums">
                  {wonTrades}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Trades Lost
                </span>
                <p className="text-2xl font-display font-bold text-red-600 mt-1 tabular-nums">
                  {lostTrades}
                </p>
              </div>
            </div>

            <PnlGrowthChart trades={trades} />

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="text-sm font-bold font-display text-slate-900">
                Institutional Execution Ledger
              </h2>
              <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                {(["ALL", "PENDING", "WON", "LOST", "BREAKEAVEN"] as const).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setJournalFilter(st)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        journalFilter === st
                          ? "bg-emerald-600 text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>

            {filteredTrades.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
                <BookOpen className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">
                  No Trade Logs Recorded Under This Filter
                </p>
                <p className="text-xs text-slate-500">
                  Save setups from the Quant Terminal to track your execution
                  metrics and equity curve.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTrades.map((trade) => {
                  const isExpanded = expandedTradeId === trade.id;
                  return (
                    <div
                      key={trade.id}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all"
                    >
                      <div
                        onClick={() =>
                          setExpandedTradeId(isExpanded ? null : trade.id)
                        }
                        className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase border ${
                              trade.bias === "BULLISH"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {trade.bias}
                          </span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 font-display">
                              {trade.symbol}{" "}
                              <span className="text-xs font-mono text-slate-500">
                                ({trade.timeframe})
                              </span>
                            </h3>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Entry: {trade.entry_price} · SL: {trade.stop_loss}{" "}
                              · TP: {trade.take_profit}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={trade.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleUpdateStatus(
                                trade.id,
                                e.target.value as any
                              )
                            }
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="WON">WON</option>
                            <option value="LOST">LOST</option>
                            <option value="BREAKEAVEN">BREAKEVEN</option>
                          </select>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPDF(trade);
                            }}
                            disabled={exportingId === trade.id}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                            title="Export PDF Dossier"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteTrade(trade.id, e)}
                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer"
                            title="Delete Trade"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-4">
                          <p className="text-xs text-slate-700 leading-relaxed">
                            <strong>Notes:</strong> {trade.notes}
                          </p>
                          <TradeSettlementForm
                            trade={trade}
                            onSave={async (status, exitPrice, pnl) => {
                              await updateTradeStatus(
                                trade.id,
                                status,
                                exitPrice,
                                pnl
                              );
                              setDbConfigUpdated((prev) => prev + 1);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 4: CLOUD SYNC & DIAGNOSTICS
        ========================================== */}
        {activeTab === "databases" && (
          <div className="max-w-3xl mx-auto">
            <DatabaseSetup
              onConfigChange={() => setDbConfigUpdated((prev) => prev + 1)}
            />
          </div>
        )}
      </main>

      {/* AI MENTOR SLIDE-OVER SIDEBAR */}
      {chatSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs">
          <div className="w-full max-w-md h-full shadow-2xl">
            <ChatSidebar
              currentAnalysis={analysisResult}
              tradeHistory={trades}
              activeSymbol={symbol}
              onClose={() => setChatSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* QUICK NOTE MODAL */}
      {isQuickNoteOpen && (
        <QuickNoteModal
          trades={trades}
          currentSymbol={symbol.ticker}
          onClose={() => setIsQuickNoteOpen(false)}
          onSave={handleQuickNoteSave}
        />
      )}
    </div>
  );
}
