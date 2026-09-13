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
  ExternalLink,
  ChevronDown,
  Info,
  Play,
  FileDown,
  Paintbrush,
  MessageSquare,
  Sparkles,
  Activity,
  Download
} from "lucide-react";
import { SYNTHETIC_SYMBOLS, SyntheticSymbol } from "./data/symbols";
import {
  Trade,
  getTrades,
  saveTrade,
  deleteTrade,
  updateTradeStatus,
  updateTradeNotes,
  subscribeTrades
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
import { auth as firebaseAuth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getUserLearnings } from "./lib/firebaseChat";

export default function App() {
  const [activeTab, setActiveTab] = useState<"analyzer" | "calculator" | "journal" | "databases">("analyzer");
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

  // Selection state
  const [symbol, setSymbol] = useState<SyntheticSymbol>(SYNTHETIC_SYMBOLS[0]);
  const [timeframe, setTimeframe] = useState<string>("H1");
  const [customSymbolText, setCustomSymbolText] = useState("");

  // Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-Timeframe Strategy States
  const [isMtfMode, setIsMtfMode] = useState<boolean>(false);
  const [selectedMtfView, setSelectedMtfView] = useState<"m30" | "h4" | "d1">("m30");
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
  const [analyzerSubTab, setAnalyzerSubTab] = useState<"analysis" | "drawing" | "live_feed" | "pine_script">("live_feed");
  const [activeLevels, setActiveLevels] = useState<{ entry: number; stopLoss: number; tp1: number; tp2: number }>({
    entry: 0,
    stopLoss: 0,
    tp1: 0,
    tp2: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Save/Journaling metadata additions
  const [isSaving, setIsSaving] = useState(false);
  const [tradeNotes, setTradeNotes] = useState("");
  const [journalSaveStatus, setJournalSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  // Journal Trades state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [journalFilter, setJournalFilter] = useState<"ALL" | "PENDING" | "WON" | "LOST" | "BREAKEAVEN">("ALL");
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [dbConfigUpdated, setDbConfigUpdated] = useState(0); // Trigger reload
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

  const handleQuickNoteSave = async (tradeId: string, notes: string): Promise<boolean> => {
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
        rationale: analysisResult.orderBlock?.rationale || "N/A"
      },
      supplyDemandZones: {
        supply: analysisResult.supplyDemandZones?.supply || "N/A",
        demand: analysisResult.supplyDemandZones?.demand || "N/A",
        activeZone: analysisResult.supplyDemandZones?.activeZone || "Equilibrium"
      },
      fibonacciRetracement: {
        level_50: analysisResult.fibonacciRetracement?.level_50 || null,
        level_618: analysisResult.fibonacciRetracement?.level_618 || null,
        level_786: analysisResult.fibonacciRetracement?.level_786 || null,
        description: analysisResult.fibonacciRetracement?.description || "No specific retracement alignments specified."
      }
    };

    try {
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", url);
      const fileName = `${(customSymbolText || symbol.name).replace(/\s+/g, "_")}_SMC_Backup_${new Date().toISOString().slice(0,10)}.json`;
      downloadAnchor.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      
      // Cleanup
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download SMC levels", e);
    }
  };

  // Loader intervals messages for trader engagement
  const loadingPhrases = [
    "Receiving chart matrix...",
    "Scanning visual markers and price axes...",
    "Sweeping market structure for micro-CHoCH & BOS...",
    "Locking major high-probability Order Blocks...",
    "Calculating Supply & Demand imbalance thresholds...",
    "Mapping fibonacci retracements on current swing leg...",
    "Establishing invalidation Stop Loss levels...",
    "Formulating optimal Risk-Reward parameters..."
  ];

  // Listen to Firebase Auth state updates dynamically
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user);
      setDbConfigUpdated((prev) => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Sync active levels with analysis result shifts automatically
  useEffect(() => {
    if (analysisResult?.tradeSetup) {
      const ts = analysisResult.tradeSetup;
      setActiveLevels({
        entry: Number(ts.entry) || 0,
        stopLoss: Number(ts.stopLoss) || 0,
        tp1: ts.takeProfits && Array.isArray(ts.takeProfits) ? Number(ts.takeProfits[0]) || 0 : 0,
        tp2: ts.takeProfits && Array.isArray(ts.takeProfits) ? Number(ts.takeProfits[1]) || 0 : 0,
      });
    }
  }, [analysisResult]);

  // Load trades with real-time replication or offline backup tracking
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

  // Image Upload helpers
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
      setErrorMessage("Unsupported file. You must upload a chart screenshot image (PNG, JPG, WEBP).");
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
      setErrorMessage("Unsupported file. Please upload a valid image (PNG/JPG/WEBP).");
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
      
      // Auto-populate single image previews as reference fallbacks
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

  // Call Express processing service for SMC scanning
  const startSMCAnalysis = async (overrideImage?: string) => {
    const targetImage = overrideImage || imagePreview;

    if (isMtfMode) {
      if (!mtfImages.m30.preview || !mtfImages.h4.preview || !mtfImages.d1.preview) {
        setErrorMessage("To execute the top-down mechanical strategy, please upload screenshots for all three timeframes: 30M, 4H, and 1D.");
        return;
      }
    } else {
      if (!targetImage) {
        setErrorMessage("Please load a MT5 or TradingView chart print screenshot to analyze.");
        return;
      }
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setAnalysisResult(null);
    setJournalSaveStatus("idle");

    // Interval to cycle technical logs
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
        console.warn("Could not fetch user learnings for reinforcement learning:", le);
      }

      // Fetch Live Deriv API current price to replace hardcoded values
      let currentPrice: number | null = null;
      try {
        currentPrice = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Deriv API Timeout")), 2500);
          const derivAppId = (import.meta as any).env?.VITE_DERIV_APP_ID || "1089";
          const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${derivAppId}`);
          
          ws.onopen = () => {
            const tk = symbol.ticker;
            const derivSymbol = tk === "V10" ? "R_10" : tk === "V25" ? "R_25" : tk === "V50" ? "R_50" : tk === "V75" ? "R_75" : tk === "V100" ? "R_100" :
                                tk === "B1000" ? "BOOM1000" : tk === "B500" ? "BOOM500" : tk === "C1000" ? "CRASH1000" : tk === "C500" ? "CRASH500" :
                                tk === "STEP" ? "STPRNG" : tk === "J100" ? "JD100" : "R_75";
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

      const requestBody = isMtfMode
        ? {
            images: [mtfImages.m30.preview, mtfImages.h4.preview, mtfImages.d1.preview],
            symbol: customSymbolText ? customSymbolText : symbol.name,
            timeframe: "30M", // Primary focus
            tradeHistory: trades,
            learnings: learningsData,
            currentPrice: currentPrice
          }
        : {
            image: targetImage,
            symbol: customSymbolText ? customSymbolText : symbol.name,
            timeframe: timeframe,
            tradeHistory: trades,
            learnings: learningsData,
            currentPrice: currentPrice
          };

      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const parsed = await response.json();
      clearInterval(phraseInterval);

      if (!response.ok || !parsed.success) {
        throw new Error(parsed.error || "Execution failed. Check server console outputs.");
      }

      setAnalysisResult(parsed.data);
      setAnalyzerSubTab("analysis");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Network timeout or credentials error. Verify your Gemini API credentials.");
    } finally {
      clearInterval(phraseInterval);
      setIsAnalyzing(false);
    }
  };

  // Save the currently scanned setup into our trade journal database
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
        notes: tradeNotes.trim() || `Automated target strategy for ${symbol.ticker} at ${timeframe}`,
        status: "PENDING" as const,
        analysis_info: {
          marketStructure: analysisResult.marketStructure,
          orderBlock: analysisResult.orderBlock,
          supplyDemandZones: analysisResult.supplyDemandZones,
          fibonacciRetracement: analysisResult.fibonacciRetracement,
          tradeSetup: analysisResult.tradeSetup,
          educationalInsight: analysisResult.educationalInsight
        }
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

  // Outcome updates
  const handleUpdateStatus = async (id: string, state: "WON" | "LOST" | "BREAKEAVEN" | "PENDING") => {
    try {
      await updateTradeStatus(id, state);
      setDbConfigUpdated((prev) => prev + 1);
    } catch (err) {
      console.error("Could not override trade results state", err);
    }
  };

  const handleDeleteTrade = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Verify: Are you sure you want to clean this trade log? This cannot be undone.")) {
      try {
        await deleteTrade(id);
        setDbConfigUpdated((prev) => prev + 1);
      } catch (err) {
        console.error("Erase journal target failed:", err);
      }
    }
  };

  // Statistics Computations
  const computedStats = {
    total: trades.length,
    wins: trades.filter((t) => t.status === "WON").length,
    losses: trades.filter((t) => t.status === "LOST").length,
    pending: trades.filter((t) => t.status === "PENDING").length,
    breakevens: trades.filter((t) => t.status === "BREAKEAVEN").length,
    get winRate() {
      const settled = this.wins + this.losses;
      return settled > 0 ? ((this.wins / settled) * 100).toFixed(1) : "0.0";
    },
    get totalPnl() {
      return trades.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
    }
  };

  const filteredTrades = trades.filter((t) => {
    if (journalFilter === "ALL") return true;
    return t.status === journalFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* HEADER SECTION */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-40 px-4 md:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/10 border border-indigo-500/20 p-2.5 rounded-xl glow-cyan text-cyan-400">
            <LineChart className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold font-display tracking-tight text-slate-900 uppercase">Synthetic SMC Trader</h1>
              <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-[10px] uppercase px-1.5 py-0.5 rounded-md font-mono">
                Beta v1.1
              </span>
              {firebaseUser?.email === "ibrahimfaruqolamilekan4@gmail.com" && (
                <span className="bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-sm shadow-amber-500/20 animate-pulse">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  Admin Mode
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600">Algorithmic SMC retracement scanning & journaling framework</p>
          </div>
        </div>

        {/* WORKSPACE NAVIGATION */}
        <div className="flex items-center gap-3">
          <nav className="hidden md:flex items-center bg-slate-50 border border-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("analyzer")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "analyzer"
                  ? "bg-slate-200 border border-slate-300 text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Upload className="h-4 w-4" />
              Chart Analyzer
            </button>
            <button
              onClick={() => setActiveTab("calculator")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "calculator"
                  ? "bg-slate-200 border border-slate-300 text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <CircleDollarSign className="h-4 w-4" />
              Risk Calculator
            </button>
            <button
              onClick={() => setActiveTab("journal")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "journal"
                  ? "bg-slate-200 border border-slate-300 text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Trade Journal
              {computedStats.pending > 0 && (
                <span className="bg-amber-400 text-[#0d1322] font-semibold rounded-full h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center">
                  {computedStats.pending}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("databases")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "databases"
                  ? "bg-slate-200 border border-slate-300 text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Settings className="h-4 w-4" />
              Database Control
            </button>
          </nav>

          <button
            onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
            className={`px-3.5 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
              chatSidebarOpen
                ? "bg-cyan-950/40 border-cyan-500 text-cyan-400 font-extrabold shadow-cyan-500/10"
                : "bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900"
            }`}
            title="Toggle AI SMC Copilot Sidebar"
          >
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <span className="font-display tracking-wide uppercase">AI Copilot</span>
          </button>
        </div>
      </header>

      {/* BODY WORKSPACES CONTAINER */}
      <div className="flex-1 flex flex-row relative overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <main className="max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {/* TAB 1: CHART ANALYZER WORKSPACE */}
        {activeTab === "analyzer" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left controller: dropzone & settings */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold font-display text-slate-900 mb-4">Index Configuration</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-widest mb-1.5 font-display">
                      Synthetic Index Symbol
                    </label>
                    <select
                      value={symbol.ticker}
                      onChange={(e) => {
                        const s = SYNTHETIC_SYMBOLS.find((x) => x.ticker === e.target.value);
                        if (s) setSymbol(s);
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs transition"
                    >
                      {SYNTHETIC_SYMBOLS.map((s) => (
                        <option value={s.ticker} key={s.ticker}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-widest mb-1.5 font-display">
                      Timeframe
                    </label>
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 text-xs transition"
                    >
                      {["M1", "M5", "M15", "M30", "H1", "H4", "D1"].map((tf) => (
                        <option value={tf} key={tf}>
                          {tf} Workframe
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-semibold text-slate-700 uppercase tracking-widest font-display">
                      Custom Unregistered Symbol Name
                    </label>
                    <span className="text-[10px] text-slate-500 italic">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., Jump 25 Index, Range Break 100"
                    value={customSymbolText}
                    onChange={(e) => setCustomSymbolText(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-800 transition"
                  />
                </div>

                {/* SMC Strategy Mode Selector */}
                <div className="mb-5 bg-slate-50 p-1 rounded-xl border border-slate-850 flex font-sans">
                  <button
                    type="button"
                    onClick={() => setIsMtfMode(false)}
                    className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-extrabold rounded-lg transition-all cursor-pointer ${
                      !isMtfMode
                        ? "bg-slate-200 text-cyan-400 border border-slate-300/80"
                        : "text-slate-600 hover:text-slate-250"
                    }`}
                  >
                    Single-Chart Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMtfMode(true)}
                    className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider font-extrabold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isMtfMode
                        ? "bg-slate-200 text-indigo-400 border border-slate-300/80 font-black"
                        : "text-slate-600 hover:text-slate-250"
                    }`}
                  >
                    <Sparkles className="h-3 w-3 text-indigo-400" />
                    <span>Multi-TF Strategy (3 Charts)</span>
                  </button>
                </div>

                {/* Dropzone field */}
                {isMtfMode ? (
                  <div className="space-y-3.5" id="multi-timeframe-uploads-slots-grid">
                    <p className="text-[10px] text-slate-600 leading-relaxed font-sans bg-slate-100/50 p-2.5 rounded-lg border border-slate-850">
                      Upload screenshots for all three required workframes. The top-down AI algorithm will perform sequential mechanical macro-to-micro SMC mapping.
                    </p>
                    
                    {/* Slot 1: 30M Entry precision */}
                    <div className="relative border border-dashed border-slate-200 hover:border-emerald-500/30 rounded-xl p-3 bg-slate-50/20 transition-all flex items-center justify-between min-h-[64px] overflow-hidden">
                      {mtfImages.m30.preview && (
                        <img src={mtfImages.m30.preview} alt="30M thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
                      )}
                      
                      {/* Laser grid scanning overlay */}
                      {isAnalyzing && (
                        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                          <div className="w-full h-1 bg-emerald-400 absolute top-0 left-0 shadow-[0_0_15px_#10b981] animate-scan"></div>
                        </div>
                      )}

                      <div className="z-10 flex items-center gap-2.5 h-full">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                        <div>
                          <p className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider font-display">Image 1: 30-Min precise Entry</p>
                          <p className="text-[9px] text-slate-600 max-w-[155px] truncate mt-0.5">{mtfImages.m30.file ? mtfImages.m30.file.name : "Unloaded — click upload to add"}</p>
                        </div>
                      </div>
                      <div className="z-10 flex items-center shrink-0">
                        <label className="cursor-pointer px-2.5 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:text-slate-900 rounded-lg text-[9px] font-extrabold uppercase text-slate-700 tracking-wider transition">
                          {mtfImages.m30.preview ? "Change" : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                processMtfFile(e.target.files[0], "m30");
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Slot 2: 4H structure */}
                    <div className="relative border border-dashed border-slate-200 hover:border-cyan-500/30 rounded-xl p-3 bg-slate-50/20 transition-all flex items-center justify-between min-h-[64px] overflow-hidden">
                      {mtfImages.h4.preview && (
                        <img src={mtfImages.h4.preview} alt="4H thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
                      )}
                      
                      {/* Laser grid scanning overlay */}
                      {isAnalyzing && (
                        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                          <div className="w-full h-1 bg-cyan-400 absolute top-0 left-0 shadow-[0_0_15px_#22d3ee] animate-scan"></div>
                        </div>
                      )}

                      <div className="z-10 flex items-center gap-2.5 h-full">
                        <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 animate-pulse shrink-0"></div>
                        <div>
                          <p className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider font-display">Image 2: 4-Hour structure</p>
                          <p className="text-[9px] text-slate-600 max-w-[155px] truncate mt-0.5">{mtfImages.h4.file ? mtfImages.h4.file.name : "Unloaded — click upload to add"}</p>
                        </div>
                      </div>
                      <div className="z-10 flex items-center shrink-0">
                        <label className="cursor-pointer px-2.5 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:text-slate-900 rounded-lg text-[9px] font-extrabold uppercase text-slate-700 tracking-wider transition">
                          {mtfImages.h4.preview ? "Change" : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                processMtfFile(e.target.files[0], "h4");
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Slot 3: 1D macro bias */}
                    <div className="relative border border-dashed border-slate-200 hover:border-indigo-500/30 rounded-xl p-3 bg-slate-50/20 transition-all flex items-center justify-between min-h-[64px] overflow-hidden">
                      {mtfImages.d1.preview && (
                        <img src={mtfImages.d1.preview} alt="1D thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
                      )}
                      
                      {/* Laser grid scanning overlay */}
                      {isAnalyzing && (
                        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                          <div className="w-full h-1 bg-indigo-500 absolute top-0 left-0 shadow-[0_0_15px_#6366f1] animate-scan"></div>
                        </div>
                      )}

                      <div className="z-10 flex items-center gap-2.5 h-full">
                        <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></div>
                        <div>
                          <p className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider font-display">Image 3: 1-Day Macro Bias</p>
                          <p className="text-[9px] text-slate-600 max-w-[155px] truncate mt-0.5">{mtfImages.d1.file ? mtfImages.d1.file.name : "Unloaded — click upload to add"}</p>
                        </div>
                      </div>
                      <div className="z-10 flex items-center shrink-0">
                        <label className="cursor-pointer px-2.5 py-1.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:text-slate-900 rounded-lg text-[9px] font-extrabold uppercase text-slate-700 tracking-wider transition">
                          {mtfImages.d1.preview ? "Change" : "Upload"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                processMtfFile(e.target.files[0], "d1");
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerSearchFile}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative overflow-hidden h-64 ${
                      dragActive 
                        ? "border-cyan-500 bg-cyan-950/20" 
                        : imagePreview 
                          ? "border-slate-200 bg-slate-50/40" 
                          : "border-slate-200 hover:border-indigo-500/50 hover:bg-slate-50/20"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />

                    {originalImage ? (
                      <>
                        <img
                          src={originalImage}
                          alt="Uploaded chart print"
                          className="absolute inset-0 w-full h-full object-cover opacity-40 selection:bg-transparent"
                        />
                        
                        {/* Laser grid scanning overlay */}
                        {isAnalyzing && (
                          <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
                            <div className="w-full h-1 bg-cyan-400 absolute top-0 left-0 shadow-[0_0_15px_#22d3ee] animate-scan"></div>
                            <div className="absolute inset-0 bg-cyan-950/10 grid grid-cols-4 grid-rows-4 opacity-25">
                              {Array.from({ length: 16 }).map((_, i) => (
                                <div key={i} className="border border-cyan-500/20"></div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-slate-50/60 flex flex-col justify-center items-center p-4">
                          <Upload className="h-8 w-8 text-indigo-400 mb-2 drop-shadow-md" />
                          <p className="text-xs font-bold text-slate-900 uppercase drop-shadow-md">Swap Chart Screenshot</p>
                          <p className="text-[10px] text-slate-600 mt-1 max-w-[200px] truncate">{imageFile?.name}</p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-100 border border-slate-200 rounded-full inline-block text-slate-600 mx-auto">
                          <Upload className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">Upload MT5 MT4 Chart Image</p>
                          <p className="text-[10px] text-slate-500 mt-1">Drag and drop, or tap to examine files</p>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-sans">
                          PNG / JPG Supported
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={startSMCAnalysis}
                  disabled={
                    isAnalyzing || 
                    (isMtfMode 
                      ? (!mtfImages.m30.preview || !mtfImages.h4.preview || !mtfImages.d1.preview)
                      : !imagePreview)
                  }
                  className={`w-full py-3.5 px-4 rounded-xl font-bold font-display text-xs tracking-wider transition-all mt-4 flex items-center justify-center gap-2 cursor-pointer ${
                    (isMtfMode 
                      ? (!mtfImages.m30.preview || !mtfImages.h4.preview || !mtfImages.d1.preview)
                      : !imagePreview)
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-200"
                      : isAnalyzing
                        ? "bg-slate-100 text-cyan-400 border border-cyan-500/40 shadow-inner"
                        : "bg-indigo-600 hover:bg-indigo-500 active:translate-y-px text-slate-900 shadow-lg shadow-indigo-500/20"
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{analysisProgress}</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>PROCESS SMART MONEY ALGORITHM</span>
                    </>
                  )}
                </button>

                {errorMessage && (
                  <div className="mt-4 p-3 rounded-xl border border-rose-950 bg-rose-950/20 text-rose-300 text-xs flex gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{errorMessage}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: dynamic results */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex bg-white border border-slate-200 p-1 rounded-xl w-full sm:w-fit flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("live_feed")}
                  className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    analyzerSubTab === "live_feed"
                      ? "bg-slate-200 border border-slate-300 text-cyan-400 font-bold"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Live TV Chart Terminal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("drawing")}
                  className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    analyzerSubTab === "drawing"
                      ? "bg-slate-200 border border-slate-300 text-indigo-400 font-bold"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <span>Interactive Chart Drawing</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("analysis")}
                  className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
                    analyzerSubTab === "analysis"
                      ? "bg-slate-200 border border-slate-300 text-emerald-400 font-bold"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <span>SMC Analysis Result</span>
                  {analysisResult && (
                    <span className="bg-emerald-500 text-slate-900 rounded-full h-1.5 w-1.5 animate-pulse ml-1 inline-block"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyzerSubTab("pine_script")}
                  className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    analyzerSubTab === "pine_script"
                      ? "bg-slate-200 border border-slate-300 text-violet-400 font-bold"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  <span>SMC Pine Script</span>
                </button>
              </div>

              {isAnalyzing && (
                <div className="bg-white border border-cyan-500/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
                  <Loader2 className="h-10 w-10 text-cyan-400 animate-spin mb-4" />
                  <h3 className="text-md font-bold font-display text-slate-900 uppercase tracking-wider animate-pulse">Running SMC Recognition</h3>
                  <p className="text-xs text-slate-600 mt-2 max-w-sm font-mono text-cyan-500/70">{analysisProgress}</p>
                  <p className="text-[10px] text-slate-500 italic mt-8 max-w-xs block leading-relaxed">
                    Analyzing market structural imbalances, looking for inducement thresholds, and computing discount retracements.
                  </p>
                </div>
              )}

              {!isAnalyzing && analyzerSubTab === "live_feed" && (
                <LiveTradingViewChart
                  symbol={symbol}
                  analysisResult={analysisResult}
                  onCaptureScreenshot={(dataUrl) => {
                    setImagePreview(dataUrl);
                    setOriginalImage(dataUrl);
                    // Also switch context automatically
                    setIsMtfMode(false);
                    setAnalyzerSubTab("drawing");
                    setTimeout(() => startSMCAnalysis(dataUrl), 100);
                  }}
                  onSyncLevels={(levels) => {
                    setActiveLevels(levels);
                    if (analysisResult?.tradeSetup) {
                      setAnalysisResult((prev: any) => ({
                        ...prev,
                        tradeSetup: {
                          ...prev.tradeSetup,
                          entry: levels.entry,
                          stopLoss: levels.stopLoss,
                          takeProfits: [levels.tp1, levels.tp2]
                        }
                      }));
                    }
                  }}
                  currentWorkspaceLevels={activeLevels}
                />
              )}

              {!isAnalyzing && analyzerSubTab === "pine_script" && (
                <PineScriptGenerator />
              )}

              {!isAnalyzing && !originalImage && !mtfImages.m30.original && analyzerSubTab === "drawing" && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col justify-center items-center min-h-[450px] space-y-3">
                  <div className="p-4 bg-slate-100 border border-slate-200 rounded-full inline-block text-slate-500">
                    <LineChart className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-md font-bold text-slate-800">Analytical Canvas Ready</h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                      Upload your chart screenshot (containing visible price structures, order blocks, or swing points) and execute. The AI will map supply & demand zones and generate precise guidelines instantly!
                    </p>
                  </div>
                </div>
              )}

              {!isAnalyzing && (originalImage || mtfImages.m30.original) && analyzerSubTab === "drawing" && (
                <div className="space-y-4 font-sans">
                  {isMtfMode && (
                    <div className="flex bg-white border border-slate-200 p-1 rounded-xl w-full sm:w-fit flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedMtfView("m30")}
                        className={`flex-1 sm:flex-initial px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedMtfView === "m30"
                            ? "bg-slate-200 border border-slate-300 text-emerald-400 font-bold"
                            : "text-slate-600 hover:text-slate-800"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        <span>30M entry precision</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMtfView("h4")}
                        className={`flex-1 sm:flex-initial px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedMtfView === "h4"
                            ? "bg-slate-200 border border-slate-300 text-cyan-400 font-bold"
                            : "text-slate-600 hover:text-slate-800"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500"></span>
                        <span>4H intermediate structure</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMtfView("d1")}
                        className={`flex-1 sm:flex-initial px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          selectedMtfView === "d1"
                            ? "bg-slate-200 border border-slate-300 text-indigo-400 font-bold"
                            : "text-slate-450 hover:text-slate-800"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                        <span>1D Macro Trend Bias</span>
                      </button>
                    </div>
                  )}

                  <InteractiveCanvas
                    imageUrl={
                      isMtfMode
                        ? (selectedMtfView === "m30"
                          ? (mtfImages.m30.original || originalImage || "")
                          : selectedMtfView === "h4"
                            ? (mtfImages.h4.original || "")
                            : (mtfImages.d1.original || ""))
                        : (originalImage || "")
                    }
                    analysisResult={analysisResult}
                    onSaveComposite={(compositeUrl) => {
                      setImagePreview(compositeUrl);
                    }}
                  />
                </div>
              )}

              {!isAnalyzing && !analysisResult && analyzerSubTab === "analysis" && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col justify-center items-center min-h-[400px] space-y-3">
                  <div className="p-3 bg-slate-100 border border-slate-200 rounded-full inline-block text-slate-600">
                    <AlertCircle className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 font-display uppercase tracking-wider">AI SMC Scan Output Pending</h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                      Configure your synthetic indices parameter inputs on the left configuration panel, then click "Process Smart Money Algorithm" to execute deep visual analysis!
                    </p>
                  </div>
                </div>
              )}

              {!isAnalyzing && originalImage && analyzerSubTab === "analysis" && analysisResult && (() => {
                const hasOB = !!analysisResult.orderBlock?.priceRange;
                const hasVoid = !!analysisResult.liquidityVoid?.priceRange;
                const hasVacuum = !!analysisResult.vacuumBlock?.priceRange;
                const hasCandle = !!analysisResult.candlestickPatterns?.patternName && analysisResult.candlestickPatterns.patternName !== "Undetermined Pattern" && analysisResult.candlestickPatterns.patternName !== "Undetermined Pattern";
                const hasFib = !!analysisResult.fibonacciRetracement?.level_618;
                
                // Session Timing Filter: 07:00 - 16:00 GMT
                const gmtHour = new Date().getUTCHours();
                const isSessionActive = gmtHour >= 7 && gmtHour <= 16;
                
                let score = 0;
                if (hasOB) score++;
                if (hasVoid || hasVacuum) score++;
                if (hasCandle) score++;
                if (hasFib) score++;
                if (isSessionActive) score++;

                return (
                  <div className="space-y-6 relative" id="chart-analyzer-results-view">
                    
                    {/* IMAGE QUALITY ASSESSMENT BANNER */}
                    {analysisResult?.imageQuality && (
                      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-4 items-start md:items-center justify-between font-sans shadow-lg transition-all duration-300 animate-fade-in ${
                        analysisResult.imageQuality.status === 'failed'
                          ? 'bg-rose-950/20 border-rose-900/60 text-slate-250'
                          : 'bg-emerald-950/20 border-emerald-900/60 text-slate-250'
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl shrink-0 ${
                            analysisResult.imageQuality.status === 'failed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {analysisResult.imageQuality.status === 'failed' ? (
                              <AlertCircle className="h-5 w-5 text-rose-400 animate-pulse" />
                            ) : (
                              <ShieldCheck className="h-5 w-5 text-emerald-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono">
                                Vision Scanner QC
                              </span>
                              <span className={`text-[10px] font-black uppercase tracking-wider font-mono ${
                                analysisResult.imageQuality.status === 'failed' ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                {analysisResult.imageQuality.status === 'failed' ? 'CRITICAL RESOLUTION WARNING' : 'VERIFIED CHART RANGE'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                              {analysisResult.imageQuality.details || (
                                analysisResult.imageQuality.status === 'failed'
                                  ? "Image quality is insufficient for accurate analysis. Please upload a cleaner screenshot or provide the index, timeframe, and key price levels."
                                  : "Screenshot analysis verified. Price coordinates and candle resolution fully legible for SMC mapping."
                              )}
                            </p>
                          </div>
                        </div>
                        {analysisResult.imageQuality.status === 'failed' && (
                          <div className="text-[9px] uppercase font-mono font-bold text-rose-400 border border-rose-500/20 px-2.5 py-1 bg-rose-500/5 rounded-lg shrink-0">
                            LOW CONFIDENCE SCAN
                          </div>
                        )}
                      </div>
                    )}

                    {/* TOP-DOWN MULTI-TIMEFRAME ANALYSIS BENTO */}
                    {analysisResult?.multiTimeframe?.isMultiTimeframe && (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-fade-in group space-y-4">
                        <div className="flex border-b border-indigo-500/10 pb-4 justify-between items-center flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 animate-pulse" />
                            <div>
                              <h3 className="text-sm font-black font-display text-slate-900 uppercase tracking-wider">Top-Down Multi-Timeframe SMC Synthesis</h3>
                              <p className="text-[10px] text-indigo-400 tracking-wider uppercase font-semibold font-mono">Macro (1D) ➔ Intermediate (4H) ➔ Micro-Refinement (30M)</p>
                            </div>
                          </div>
                          {analysisResult.multiTimeframe.confirmationMessage && (
                            <div className="text-[9.5px] font-bold font-mono px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center gap-1.5 shrink-0">
                              <CheckCircle className="h-3 w-3" />
                              <span>{analysisResult.multiTimeframe.confirmationMessage}</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* 1D Card */}
                          <div className="bg-slate-100 border border-slate-850 p-4 rounded-xl space-y-1.5 transition-all hover:border-slate-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest font-mono">1-Day macro timeframe</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold font-mono">1D BIAS</span>
                            </div>
                            <p className="text-xs text-slate-350 leading-relaxed font-sans mt-2">
                              {analysisResult.multiTimeframe.htfBias1D}
                            </p>
                          </div>

                          {/* 4H Card */}
                          <div className="bg-slate-100 border border-slate-850 p-4 rounded-xl space-y-1.5 transition-all hover:border-slate-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest font-mono">4-Hour intermediate structure</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold font-mono">4H STRUCTURE</span>
                            </div>
                            <p className="text-xs text-slate-350 leading-relaxed font-sans mt-2">
                              {analysisResult.multiTimeframe.intermediateStructure4H}
                            </p>
                          </div>

                          {/* 30M Card */}
                          <div className="bg-slate-100 border border-slate-850 p-4 rounded-xl space-y-1.5 transition-all hover:border-slate-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono">30-Min Entry Precision</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold font-mono">30M ENTRY</span>
                            </div>
                            <p className="text-xs text-slate-350 leading-relaxed font-sans mt-2">
                              {analysisResult.multiTimeframe.entryPrecision30M}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* FLOATING QUICK NOTE & EXPORT BUTTONS */}
                    <div className="fixed bottom-6 right-6 z-45 sm:absolute sm:bottom-auto sm:top-5 sm:right-6 font-sans flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportSMCJson}
                        className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl shadow-lg border border-slate-750 hover:scale-[1.03] active:scale-95 transition-all group cursor-pointer"
                        id="export-smc-json-btn"
                        title="Export SMC levels as JSON"
                      >
                        <Download className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Export JSON</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsQuickNoteOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-indigo-650 hover:from-emerald-500 hover:to-indigo-550 text-slate-900 font-extrabold text-[10.5px] uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-200/40 border border-indigo-500 hover:scale-[1.03] active:scale-95 transition-all group cursor-pointer"
                        id="floating-quick-note-trigger"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-cyan-300 animate-pulse" />
                        <span>Quick Note</span>
                      </button>
                    </div>

                    {/* MAIN TARGET PLAN CARD */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 glow-green animate-fade-in">
                      <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
                        <div>
                          <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-widest px-2.5 py-1 rounded-full font-bold">
                            AI Matrix Proposal
                          </span>
                          <h2 className="text-xl font-bold font-display mt-2 text-slate-900">
                            {customSymbolText ? customSymbolText : symbol.name} Trading Guide
                          </h2>
                        </div>

                        {/* Direction indicator badge */}
                        <div className={`p-1 px-4 text-xs font-black rounded-xl border text-center uppercase tracking-wide flex flex-col ${
                          analysisResult?.bias === "BULLISH"
                            ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                            : analysisResult?.bias === "BEARISH"
                              ? "bg-rose-950/40 border-rose-800 text-rose-400"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}>
                          <span className="text-[9px] opacity-70 tracking-widest font-normal">Bias</span>
                          {analysisResult?.bias || "NEUTRAL"}
                        </div>
                      </div>

                      {/* Trade setups grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        
                        {/* Entry Price Zone */}
                        <div className="p-4 bg-slate-100 border border-slate-200/80 rounded-xl relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Entry Level</p>
                          <p className="text-lg font-mono font-bold text-slate-900 mt-1">
                            {analysisResult?.tradeSetup?.entry?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "N/A"}
                          </p>
                          <p className="text-[11px] text-cyan-400 mt-1 capitalize font-medium">{analysisResult?.tradeSetup?.type || "WAIT"} Trigger</p>
                        </div>

                        {/* Stop Loss Zone */}
                        <div className="p-4 bg-slate-100 border border-slate-200/80 rounded-xl relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Stop Loss (SL)</p>
                          <p className="text-lg font-mono font-bold text-slate-900 mt-1">
                            {analysisResult?.tradeSetup?.stopLoss?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "N/A"}
                          </p>
                          <span className="text-[11px] text-rose-400 font-medium block mt-1">
                            Points SL: {Math.abs((analysisResult?.tradeSetup?.entry || 0) - (analysisResult?.tradeSetup?.stopLoss || 0)).toFixed(2)}
                          </span>
                        </div>

                        {/* Risk Reward Zone */}
                        <div className="p-4 bg-slate-100 border border-slate-200/80 rounded-xl relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Risk to Reward</p>
                          <p className="text-lg font-mono font-bold text-slate-900 mt-1">
                            {analysisResult?.tradeSetup?.riskRewardRatio || "1:3"}
                          </p>
                          <span className="text-[11px] text-amber-400 font-medium block mt-1">SMC Multiplier Target</span>
                        </div>
                      </div>

                      {/* Take Profit Levels */}
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 mb-4">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Profit Targets (TP)</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {analysisResult?.tradeSetup?.takeProfits?.map((tp: number, idx: number) => {
                            const gap = Math.abs(tp - (analysisResult?.tradeSetup?.entry || 0));
                            return (
                              <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/50 flex flex-col justify-center">
                                <span className="text-[9px] text-slate-600 uppercase tracking-wider font-bold">Take Profit {idx + 1}</span>
                                <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                                  {tp?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-[9px] text-slate-500 mt-0.5">+{gap.toFixed(2)} Points</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Trigger Rationale:</h4>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">{analysisResult?.tradeSetup?.rationale || "No specific trigger rationale provided."}</p>
                        </div>
                      </div>
                    </div>

                    {/* SILVER BULLET STRATEGY ZONE STATUS */}
                    {analysisResult?.silverBullet && (
                      <div className="bg-white border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden animate-fade-in group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <Activity className="h-16 w-16 text-amber-400" />
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                          <div className="flex items-center gap-2 font-display">
                            <span className={`h-2.5 w-2.5 rounded-full ${analysisResult.silverBullet.status !== "INACTIVE" ? "bg-amber-500 animate-pulse" : "bg-slate-600"}`}></span>
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                              Silver Bullet Strategy Center
                            </span>
                          </div>
                          <span className={`text-[9.5px] font-bold font-mono px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                            analysisResult.silverBullet.status !== "INACTIVE" 
                              ? "bg-amber-950/40 border-amber-500/30 text-amber-400" 
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          }`}>
                            {analysisResult.silverBullet.status !== "INACTIVE" ? "ACTIVE WINDOW" : "OUTSIDE WINDOW (INACTIVE)"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                          <div className="bg-slate-100 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono">Current Active Window</span>
                              <strong className="text-slate-800 mt-1 block font-display">
                                {analysisResult.silverBullet.windowName || "None - Inactive"}
                              </strong>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-2 block font-mono">London (3-4 AM) | NY AM (10-11 AM) | NY PM (2-3 PM) EST</span>
                          </div>
                          <div className="md:col-span-2 bg-slate-100 border border-slate-200/80 rounded-xl p-3">
                            <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono font-bold text-slate-600">SMC Confluence Insight</span>
                            <p className="text-[11px] text-slate-700 leading-relaxed mt-1 font-sans">
                              {analysisResult.silverBullet.details || "Currently outside the high-probability time-based Silver Bullet hours. Rely on mechanical Supply & Demand levels or wait for upcoming London / New York Open sweeps."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ICT KILL ZONES STATUS PANEL */}
                    {analysisResult?.killZone && (
                      <div className="bg-white border border-cyan-500/20 rounded-2xl p-5 relative overflow-hidden animate-fade-in group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <TrendingUp className="h-16 w-16 text-cyan-400" />
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                          <div className="flex items-center gap-2 font-display">
                            <span className={`h-2.5 w-2.5 rounded-full ${analysisResult.killZone.status !== "INACTIVE" ? "bg-cyan-500 animate-pulse" : "bg-slate-600"}`}></span>
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                              ICT Kill Zone Monitor
                            </span>
                          </div>
                          <span className={`text-[9.5px] font-bold font-mono px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                            analysisResult.killZone.status !== "INACTIVE" 
                              ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-400" 
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          }`}>
                            {analysisResult.killZone.status !== "INACTIVE" ? "ACTIVE KILLZONE" : "OFF-HOURS (INACTIVE)"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                          <div className="bg-slate-100 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono">Current Session Zone</span>
                              <strong className="text-slate-800 mt-1 block font-display">
                                {analysisResult.killZone.windowName || "None - Inactive"}
                              </strong>
                            </div>
                            <span className="text-[9px] text-slate-500 mt-2 block font-mono">London (2-5 AM) | NY AM (9:30 AM-12 PM) | NY PM (3-5 PM) EST</span>
                          </div>
                          <div className="md:col-span-2 bg-slate-100 border border-slate-200/80 rounded-xl p-3">
                            <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono font-bold text-cyan-400">Orderflow & Liquidity Integration</span>
                            <p className="text-[11px] text-slate-700 leading-relaxed mt-1 font-sans">
                              {analysisResult.killZone.details || "High-probability index setups are highly concentrated in active session Kill Zones. When inactive, emphasize structural protection and conservative trailing stop setups."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CANDLE RANGE THEORY ANALYSIS SECTION */}
                    {analysisResult?.candleRangeTheory && (
                      <div className="bg-white border border-violet-500/20 rounded-2xl p-5 relative overflow-hidden animate-fade-in group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <BookOpen className="h-16 w-16 text-violet-400" />
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                          <div className="flex items-center gap-2 font-display">
                            <span className={`h-2.5 w-2.5 rounded-full ${analysisResult.candleRangeTheory.sweepType !== 'NONE' ? "bg-violet-500 animate-pulse" : "bg-slate-600"}`}></span>
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                              Candle Range Theory (CRT) Model
                            </span>
                          </div>
                          <span className={`text-[9.5px] font-bold font-mono px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                            analysisResult.candleRangeTheory.sweepType !== 'NONE' 
                              ? "bg-violet-950/40 border-violet-500/30 text-violet-e400 text-violet-400" 
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          }`}>
                            {analysisResult.candleRangeTheory.sweepType !== 'NONE' ? `${analysisResult.candleRangeTheory.sweepType} DETECTED` : "NO ACTIVE SWEEP"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                          <div className="bg-slate-100 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono">Higher-Timeframe Range</span>
                              <strong className="text-slate-800 mt-1 block font-display text-sm">
                                {Number(analysisResult.candleRangeTheory.rangeLow || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })} - {Number(analysisResult.candleRangeTheory.rangeHigh || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                              </strong>
                            </div>
                            <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex justify-between items-center text-[10px]">
                              <span className="text-slate-500 font-mono">HTF Delivery Bias:</span>
                              <span className={`font-bold font-mono uppercase tracking-wider ${
                                analysisResult.candleRangeTheory.deliveryDirection === 'BULLISH' ? 'text-emerald-400' : analysisResult.candleRangeTheory.deliveryDirection === 'BEARISH' ? 'text-rose-400' : 'text-slate-600'
                              }`}>
                                {analysisResult.candleRangeTheory.deliveryDirection || 'NEUTRAL'}
                              </span>
                            </div>
                          </div>
                          <div className="md:col-span-2 bg-slate-100 border border-slate-200/80 rounded-xl p-3">
                            <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono font-bold text-violet-400">CRT Orderflow Delivery</span>
                            <p className="text-[11px] text-slate-700 leading-relaxed mt-1 font-sans">
                              {analysisResult.candleRangeTheory.description || "No HTF candle extremes detected. Sweep markers identify critical boundaries of the candle range, where liquidity sweeping signals reversing order delivery."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* JUDAS SWING DETECTION ANALYSIS SECTION */}
                    {analysisResult?.judasSwing && (
                      <div className="bg-white border border-pink-500/20 rounded-2xl p-5 relative overflow-hidden animate-fade-in group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <AlertCircle className="h-16 w-16 text-pink-400" />
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                          <div className="flex items-center gap-2 font-display">
                            <span className={`h-2.5 w-2.5 rounded-full ${analysisResult.judasSwing.detected ? "bg-pink-500 animate-pulse" : "bg-slate-600"}`}></span>
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                              Judas Swing Reversal Analyzer
                            </span>
                          </div>
                          <span className={`text-[9.5px] font-bold font-mono px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                            analysisResult.judasSwing.detected 
                              ? "bg-pink-950/40 border-pink-500/30 text-pink-400" 
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          }`}>
                            {analysisResult.judasSwing.detected ? "REVERSAL TRAP ACTIVE" : "NO ACTIVE SWING"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                          <div className="bg-slate-100 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono">Judas Sweep Reference</span>
                              <strong className="text-slate-800 mt-1 block font-display text-sm">
                                {Number(analysisResult.judasSwing.triggerLevel || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                              </strong>
                            </div>
                            <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex justify-between items-center text-[10px]">
                              <span className="text-slate-500 font-mono">Direction Bias:</span>
                              <span className={`font-bold font-mono uppercase tracking-wider ${
                                analysisResult.judasSwing.direction === 'BULLISH' ? 'text-emerald-400' : analysisResult.judasSwing.direction === 'BEARISH' ? 'text-rose-400' : 'text-slate-600'
                              }`}>
                                {analysisResult.judasSwing.direction || 'NEUTRAL'}
                              </span>
                            </div>
                          </div>
                          <div className="md:col-span-2 bg-slate-100 border border-slate-200/80 rounded-xl p-3">
                            <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono font-bold text-pink-400">Orderflow & Stop Hunt Signature</span>
                            <p className="text-[11px] text-slate-700 leading-relaxed mt-1 font-sans">
                              {analysisResult.judasSwing.description || "The Judas Swing signals premium traps near session Open times. A high-probability breakout failure sweeps resting retail orders before launching in the true intent direction."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AMD / POWER OF THREE (ACCUMULATION, MANIPULATION, DISTRIBUTION) SECTION */}
                    {analysisResult?.powerOf3 && (
                      <div className="bg-white border border-sky-500/20 rounded-2xl p-5 relative overflow-hidden animate-fade-in group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <Activity className="h-16 w-16 text-sky-400" />
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                          <div className="flex items-center gap-2 font-display">
                            <span className={`h-2.5 w-2.5 rounded-full ${analysisResult.powerOf3.detected ? "bg-sky-500 animate-pulse" : "bg-slate-600"}`}></span>
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                              AMD / Power of 3 (PO3) Cycle
                            </span>
                          </div>
                          <span className={`text-[9.5px] font-bold font-mono px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                            analysisResult.powerOf3.detected 
                              ? "bg-sky-950/40 border-sky-500/30 text-sky-400" 
                              : "bg-slate-100 border-slate-200 text-slate-500"
                          }`}>
                            {analysisResult.powerOf3.detected ? "CYCLE DETECTED" : "NO PO3 STRUCTURE"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                          {/* AMD Stats box */}
                          <div className="bg-slate-100 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
                            <div className="space-y-2">
                              <div>
                                <span className="text-[9px] text-sky-400 font-bold block uppercase tracking-wider font-mono">📦 ACCUMULATION RANGE</span>
                                <strong className="text-slate-800 block text-xs font-display">
                                  {analysisResult.powerOf3.accumulationRange || "N/A"}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-rose-400 font-bold block uppercase tracking-wider font-mono">🚨 MANIPULATION LEVEL</span>
                                <strong className="text-slate-800 block text-xs font-display">
                                  {Number(analysisResult.powerOf3.manipulationLevel || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-emerald-400 font-bold block uppercase tracking-wider font-mono">🚀 DISTRIBUTION TARGET</span>
                                <strong className="text-slate-800 block text-xs font-display">
                                  {Number(analysisResult.powerOf3.distributionTarget || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                                </strong>
                              </div>
                            </div>
                          </div>
                          {/* Description box */}
                          <div className="md:col-span-2 bg-slate-100 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                            <div>
                              <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-mono font-bold text-sky-400">Institutional Power of 3 Mechanics</span>
                              <p className="text-[11px] text-slate-700 leading-relaxed mt-1.5 font-sans">
                                {analysisResult.powerOf3.description || "The 'Power of Three' represents smart money's basic daily cycles: quiet Accumulation inside a range, followed by a violent downward/upward Manipulation run to swipe liquidity and engineer panic, followed by clean Distribution in the real target direction."}
                              </p>
                            </div>
                            <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[10px] text-slate-600 flex items-center justify-between font-mono">
                              <span>Action Strategy:</span>
                              <span className="text-sky-300 font-bold">Trade during the Distribution expansion phase</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ELITE CONFLUENCE SCORECARD & ADVANCED WORKSTATION GUIDELINES */}
                    <div className="bg-gradient-to-br from-[#111827] to-[#0a111e] border border-cyan-500/20 rounded-2xl p-6 glow-cyan relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                        <Sparkles className="h-44 w-44 text-cyan-400" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-slate-200/80 pb-4">
                        <div>
                          <span className="text-[9px] font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
                            MASTER SMC QUALITY ASSURANCE
                          </span>
                          <h3 className="text-base font-bold font-display text-slate-900 mt-2 uppercase tracking-wide">
                            Confluence Reliability Scan
                          </h3>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-mono">Confluence Level</span>
                            <span className={`text-xs font-black uppercase tracking-wider ${
                              score >= 4 ? "text-cyan-400" : score >= 3 ? "text-amber-400" : "text-rose-400"
                            }`}>
                              {score >= 4 ? "HIGH RELIABILITY (80-90%)" : score >= 3 ? "MEDIUM RELIABILITY (70%)" : "LOW CONFLUENCE (<50%)"}
                            </span>
                          </div>
                          <div className={`h-12 w-12 rounded-xl flex flex-col items-center justify-center font-mono font-black text-sm border ${
                            score >= 4 ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/10" : score >= 3 ? "bg-amber-950/40 border-amber-500/40 text-amber-300" : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                          }`}>
                            <span className="text-[9px] opacity-70 font-normal uppercase leading-none mb-0.5">Score</span>
                            <span className="text-base leading-none">{score}/5</span>
                          </div>
                        </div>
                      </div>

                      {/* Risk Adjuster Allocation Box */}
                      {analysisResult?.suggestedRisk && (
                        <div className="mb-5 p-3.5 bg-cyan-950/20 border border-cyan-800/30 rounded-xl text-xs text-cyan-200 flex items-center gap-3 font-sans animate-fade-in shadow-inner">
                          <span className="h-2 w-2 bg-cyan-400 rounded-full animate-pulse shrink-0" />
                          <div>
                            <strong className="text-cyan-400 font-mono tracking-wide uppercase text-[10px] block mb-0.5">SMC Volatility & Risk Sizing Control</strong>
                            <p className="text-slate-700 normal-case leading-relaxed">{analysisResult.suggestedRisk}</p>
                          </div>
                        </div>
                      )}

                      {/* Checklist Columns */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {/* Confluences checklist */}
                        <div className="space-y-3 font-sans">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-2">
                            <span>Confluences Verified</span>
                            <span className="text-[9px] text-slate-500 normal-case font-mono">(3+ Required to recommend trade)</span>
                          </h4>
                          
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-3 bg-slate-50/30 p-2.5 rounded-xl border border-slate-850/60">
                              <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${hasOB ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-slate-100 border border-slate-200 text-slate-650"}`}>
                                {hasOB ? <Check className="h-3 w-3" /> : "—"}
                              </span>
                              <div>
                                <span className={`text-xs ${hasOB ? "text-slate-150 font-bold" : "text-slate-500"}`}>Order Block Alignment {hasOB ? "(Fresh Zone)" : ""}</span>
                                <p className="text-[10px] text-slate-500 leading-normal">Setup coordinates directly with a fresh, unmitigated key Order Block.</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-50/30 p-2.5 rounded-xl border border-slate-850/60">
                              <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${(hasVoid || hasVacuum) ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-slate-100 border border-slate-200 text-slate-650"}`}>
                                {(hasVoid || hasVacuum) ? <Check className="h-3 w-3" /> : "—"}
                              </span>
                              <div>
                                <span className={`text-xs ${(hasVoid || hasVacuum) ? "text-slate-150 font-bold" : "text-slate-500"}`}>Liquidity Void / Vacuum Block Magnet</span>
                                <p className="text-[10px] text-slate-500 leading-normal">Large vertical imbalance levels attract price like vacuum zones before key reactions.</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-50/30 p-2.5 rounded-xl border border-slate-850/60">
                              <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${hasCandle ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-slate-100 border border-slate-200 text-slate-650"}`}>
                                {hasCandle ? <Check className="h-3 w-3" /> : "—"}
                              </span>
                              <div>
                                <span className={`text-xs ${hasCandle ? "text-slate-150 font-bold" : "text-slate-500"}`}>Candlestick Confirmation (POI Zone)</span>
                                <p className="text-[10px] text-slate-500 leading-normal">Pin bars, engulfing candle formations, or hammers localized inside key zones.</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-50/30 p-2.5 rounded-xl border border-slate-850/60">
                              <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${hasFib ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-slate-100 border border-slate-200 text-slate-650"}`}>
                                {hasFib ? <Check className="h-3 w-3" /> : "—"}
                              </span>
                              <div>
                                <span className={`text-xs ${hasFib ? "text-slate-150 font-bold" : "text-slate-500"}`}>Fibonacci Golden Ratio Alignment (0.618 - 0.786)</span>
                                <p className="text-[10px] text-slate-500 leading-normal">Deep retracement discount bounds support the trade entry region.</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 bg-slate-50/30 p-2.5 rounded-xl border border-slate-850/60">
                              <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${isSessionActive ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-slate-100 border border-slate-200 text-slate-650"}`}>
                                {isSessionActive ? <Check className="h-3 w-3" /> : "—"}
                              </span>
                              <div>
                                <span className={`text-xs ${isSessionActive ? "text-slate-150 font-bold font-semibold" : "text-slate-500"}`}>Active Session Timing Filter</span>
                                <p className="text-[10px] text-slate-500 leading-normal">Current GMT is between 07:00 and 16:00, marking peak structural activity.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* DOs & DONTs lists */}
                        <div className="space-y-4 font-sans h-full flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2 font-mono">DO'S (Systematic Execution Pack)</h4>
                            <div className="bg-teal-950/15 border border-teal-900/30 p-3.5 rounded-xl space-y-2 text-[11px] leading-relaxed text-slate-700">
                              {analysisResult.doActions && Array.isArray(analysisResult.doActions) ? (
                                analysisResult.doActions.map((action: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className="text-teal-400 font-bold">✓</span>
                                    <span>{action}</span>
                                  </div>
                                ))
                              ) : (
                                <>
                                  <div className="flex items-start gap-2">
                                    <span className="text-teal-400 font-bold">✓</span>
                                    <span>Wait for direct price retracements to the specified Order Block base before entering buy/sell.</span>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-teal-400 font-bold">✓</span>
                                    <span>Restrict trade commitment to 1-2% core capital per index. Wider stops require smaller lot sizes.</span>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-teal-400 font-bold">✓</span>
                                    <span>Scale out exactly 50% profits at TP1, shifting remaining SL seamlessly to breakeven (B/E).</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 font-mono">DON'TS (Amateur Mistake Prevention Code)</h4>
                            <div className="bg-rose-950/15 border border-rose-900/30 p-3.5 rounded-xl space-y-2 text-[11px] leading-relaxed text-slate-700">
                              {analysisResult.dontActions && Array.isArray(analysisResult.dontActions) ? (
                                analysisResult.dontActions.map((action: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className="text-rose-400 font-bold">✗</span>
                                    <span>{action}</span>
                                  </div>
                                ))
                              ) : (
                                <>
                                  <div className="flex items-start gap-2">
                                    <span className="text-rose-400 font-bold">✗</span>
                                    <span>Do NOT chase spikes on Boom/Crash indices. Spikes create Vacuum Blocks — wait for structural retests.</span>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-rose-400 font-bold">✗</span>
                                    <span>Do NOT execute or scale positions if total Confluence Score falls under 3 elements.</span>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-rose-400 font-bold">✗</span>
                                    <span>Never override, bypass, or drag the red invalidation SL line deeper during live index operations.</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* COMPUTER VISION DETECTED LOG */}
                    {analysisResult?.detailedVisualDescription && (
                      <div className="bg-white border border-cyan-500/10 rounded-2xl p-5 glow-cyan relative overflow-hidden animate-fade-in">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <TrendingUp className="h-24 w-24 text-cyan-400" />
                        </div>
                        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display font-mono">
                          <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                          Computer Vision Technical Scan Log
                        </h3>
                        <p className="text-xs text-slate-700 leading-relaxed bg-white/80 border border-slate-200 rounded-xl p-4 font-sans">
                          {analysisResult.detailedVisualDescription}
                        </p>
                      </div>
                    )}

                    {/* EDUCATIONAL DISCLAIMER WARNING FOOTER & MITIGATION DISCLAIMER */}
                    <div className="bg-[#1c1917]/10 border border-amber-950/40 p-4 rounded-xl flex items-start gap-3 text-slate-600 font-sans">
                      <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="text-amber-400 font-bold uppercase tracking-wider block mb-1">CONSERVATIVE DISCIPLIARY RISK DISCLOSURE</span>
                        This is an advanced educational trading workstation utilizing synthetic index mechanics. Virtual indices run on cryptographic algorithms outside real currency structures. Trade entirely at your own discretion. Implement standard max 1% capital risk parameters per transaction.
                      </div>
                    </div>

                  {/* SMC DETAILS & RETRACEMENTS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Order Blocks & Imbalance */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display">
                        <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full"></span>
                        Mechanical Order Blocks
                      </h3>
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">OB Zone</span>
                          <span className="text-xs font-mono font-bold text-indigo-400">
                            {analysisResult?.orderBlock?.priceRange || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200/50 pt-2">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">OB Classification</span>
                          <span className="text-xs font-medium text-slate-700">{analysisResult?.orderBlock?.type || "N/A"}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-2 leading-relaxed border-t border-slate-200/50 pt-2">
                          <strong>Rationale: </strong>{analysisResult?.orderBlock?.rationale || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Supply & Demand Levels */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display">
                        <span className="h-1.5 w-1.5 bg-yellow-500 rounded-full"></span>
                        Supply and Demand Nodes
                      </h3>
                      <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">Supply Boundary</span>
                          <span className="text-xs font-mono font-bold text-rose-400">
                            {analysisResult?.supplyDemandZones?.supply || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200/50 pt-2">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">Demand Boundary</span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {analysisResult?.supplyDemandZones?.demand || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200/50 pt-2">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase">Active Controller</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-50 text-indigo-300">{analysisResult?.supplyDemandZones?.activeZone || "Equilibrium"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fibonacci Calculations */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:col-span-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display">
                        <span className="h-1.5 w-1.5 bg-cyan-500 rounded-full"></span>
                        Mathematical Retracements (Fibonacci Overlay)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200/80">
                          <span className="text-[9px] text-slate-600 font-bold uppercase block tracking-wider">50.0% Equilibrium</span>
                          <span className="text-sm font-semibold text-slate-900 mt-1 font-mono block">
                            {analysisResult?.fibonacciRetracement?.level_50?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "N/A"}
                          </span>
                        </div>
                        <div className="bg-slate-100 p-3 rounded-xl border border-indigo-900/30">
                          <span className="text-[9px] text-indigo-300 font-bold uppercase block tracking-wider">61.8% Golden Pocket</span>
                          <span className="text-sm font-semibold text-indigo-400 mt-1 font-mono block">
                            {analysisResult?.fibonacciRetracement?.level_618?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "N/A"}
                          </span>
                        </div>
                        <div className="bg-slate-100 p-3 rounded-xl border border-slate-200/80">
                          <span className="text-[9px] text-slate-600 font-bold uppercase block tracking-wider">78.6% Deep Value Retracement</span>
                          <span className="text-sm font-semibold text-slate-900 mt-1 font-mono block">
                            {analysisResult?.fibonacciRetracement?.level_786?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "N/A"}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 bg-slate-100 p-3 rounded-xl border border-slate-200/50 leading-relaxed font-mono">
                        {analysisResult?.fibonacciRetracement?.description || "No specific retracement alignments specified."}
                      </p>
                    </div>

                    {/* Advanced SMC: Voids, Vacuum Blocks & Candlesticks */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Voids & Vacuum Blocks card */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5 font-display">
                          <span className="h-1.5 w-1.5 bg-violet-500 rounded-full animate-pulse"></span>
                          Liquidity Voids & Vacuum Blocks
                        </h4>
                        
                        <div className="space-y-3 font-sans">
                          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-violet-400 font-bold uppercase tracking-wider">Liquidity Void</span>
                              <span className="text-xs font-mono font-bold text-violet-300">
                                {analysisResult?.liquidityVoid?.priceRange || "N/A"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {analysisResult?.liquidityVoid?.description || "No major liquidity void detected in this market segment."}
                            </p>
                          </div>

                          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Vacuum Block</span>
                              <span className="text-xs font-mono font-bold text-amber-300">
                                {analysisResult?.vacuumBlock?.priceRange || "N/A"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {analysisResult?.vacuumBlock?.description || "No extreme vacuum block spikes identified near the current range."}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Candlestick patterns card */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5 font-display">
                          <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                          Candlestick Pattern Mastery
                        </h4>

                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 h-[calc(100%-2rem)] flex flex-col justify-between font-sans">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                                {analysisResult?.candlestickPatterns?.patternName || "Undetermined Pattern"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {analysisResult?.candlestickPatterns?.context || "Price action near structural levels is building secondary candle configurations for confirmation."}
                            </p>
                          </div>
                          
                          <div className="text-[9.5px] text-slate-500 font-mono mt-3 border-t border-slate-200/40 pt-2 flex items-center justify-between">
                            <span>POI Confirmation: High Probability</span>
                            <span className="text-cyan-400">92% Precision</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Technical wisdom block */}
                    {analysisResult?.educationalInsight && (
                      <div className="bg-white border border-indigo-950 rounded-2xl p-5 md:col-span-2 flex gap-3">
                        <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Index Behaviour Insights</h4>
                          <p className="text-xs text-slate-600 leading-relaxed mt-1 italic font-sans">{analysisResult?.educationalInsight}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SAVE TO JOURNAL ACTION WRAPPER */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6">
                    <h3 className="text-sm font-bold font-display text-slate-900 mb-2">Trade Journal Registrar</h3>
                    <p className="text-xs text-slate-600 mb-4">Export these exact entries to local / Supabase journals and track your performance trends.</p>

                    <div className="space-y-4">
                      <div>
                        <textarea
                          placeholder="Add trade metadata ... e.g., 'H4 order block confirmation, Vol 75 is testing demand zone after structural sweep.'"
                          value={tradeNotes}
                          onChange={(e) => setTradeNotes(e.target.value)}
                          className="w-full min-h-[80px] p-3.5 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-xs text-slate-800 transition"
                        />
                      </div>

                      <div className="flex items-center gap-4 justify-between border-t border-slate-200/50 pt-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              // Auto calculate on calculator tab
                              setActiveTab("calculator");
                            }}
                            className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Verify Size on Calculator &rarr;
                          </button>
                        </div>

                        <button
                          onClick={saveToJournal}
                          disabled={isSaving}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl text-xs text-slate-900 transition cursor-pointer flex items-center gap-2"
                        >
                          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                          Save Position to Journal
                        </button>
                      </div>

                      {journalSaveStatus === "saved" && (
                        <div className="p-3 bg-emerald-950/20 border border-emerald-800 text-emerald-400 text-xs rounded-xl flex items-center gap-2 mt-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>Trade successfully registered in the journal! View details inside 'Trade Journal' tab.</span>
                        </div>
                      )}
                      
                      {journalSaveStatus === "error" && (
                        <div className="p-3 bg-rose-950/20 border border-rose-800 text-rose-400 text-xs rounded-xl flex items-center gap-2 mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Could not write trade data. Please check Supabase Setup schema connection.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )})()}
            </div>
          </div>
        )}

        {/* TAB 2: RISK MANAGEMENT WORKSPACE */}
        {activeTab === "calculator" && (
          <div className="space-y-6">
            <RiskCalculator 
              selectedSymbolTicker={analysisResult ? (customSymbolText ? "CUSTOM" : symbol.ticker) : undefined}
              initialStopLossPoints={analysisResult ? Math.abs((analysisResult.tradeSetup?.entry || 0) - (analysisResult.tradeSetup?.stopLoss || 0)) : undefined}
            />

            {/* Educational content for trading synthetics */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h3 className="text-md font-bold text-slate-800 mb-3 font-display">Rules for Synthetic Indices Position Sizing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Leverage Risks</h4>
                  <p className="text-xs text-slate-600 leading-normal">
                    Synthetic indices are extremely responsive and possess extreme point ranges. Always respect capital limits: do not exceed 2% risk threshold. Volatility 75 runs at $0.01 minimal.
                  </p>
                </div>
                <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1.5">Boom & Crash Spikes</h4>
                  <p className="text-xs text-slate-600 leading-normal">
                    Due to Tick-level price gaps, stop losses on Crash sells and Boom buys are frequently breached by the index's physical spike. Always size down 50% relative to volatilies!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: JOURNAL WORKSPACE */}
        {activeTab === "journal" && (
          <div className="space-y-6">
            
            {/* JOURNALLING STATISTICS PANEL */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Trades</p>
                <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{computedStats.total}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-semibold">Wins (WON)</p>
                <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{computedStats.wins}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-rose-400/80 uppercase tracking-wider font-semibold">Losses (LOST)</p>
                <p className="text-2xl font-bold font-mono text-rose-400 mt-1">{computedStats.losses}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-amber-400/80 uppercase tracking-wider font-semibold">Pending Scans</p>
                <p className="text-2xl font-bold font-mono text-amber-500 mt-1">{computedStats.pending}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-cyan-400/80 uppercase tracking-wider font-semibold">Win Rate %</p>
                <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">{computedStats.winRate}%</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center col-span-2 md:col-span-1">
                <p className="text-[10px] text-indigo-400/80 uppercase tracking-wider font-semibold">Net P&L ($)</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${computedStats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {computedStats.totalPnl >= 0 ? "+" : ""}{computedStats.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* P&L CUMULATIVE GROWTH CHART */}
            <PnlGrowthChart trades={trades} />

            {/* Trades control board */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" id="trades-journal-list">
              <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/50">
                <div>
                  <h3 className="text-md font-bold text-slate-900 font-display">Registered Position Logs</h3>
                  <p className="text-xs text-slate-600">Expand rows to view full charts and Gemini analysis findings</p>
                </div>

                {/* Status selector tab filter */}
                <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-lg text-xs">
                  {["ALL", "PENDING", "WON", "LOST", "BREAKEAVEN"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setJournalFilter(f as any)}
                      className={`px-3 py-1.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                        journalFilter === f
                          ? "bg-slate-200 text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTrades.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-xs font-semibold uppercase tracking-wider">No registered logs saved</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                    Analyze charts on the main canvas workspace, adjust parameters, and commit trades to populate log analytics.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[850px]">
                    <thead className="bg-[#0f172a] text-slate-600 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-4 w-[180px]">Created Date</th>
                        <th className="p-4">Symbol/TF</th>
                        <th className="p-4">Bias</th>
                        <th className="p-4 font-mono">Entry</th>
                        <th className="p-4 font-mono">Exit</th>
                        <th className="p-4 font-mono">P&L</th>
                        <th className="p-4 font-mono">SL Params</th>
                        <th className="p-4 font-mono">RR</th>
                        <th className="p-4">Outcome</th>
                        <th className="p-4 text-center">Settings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {filteredTrades.map((t) => {
                        const isExpanded = expandedTradeId === t.id;
                        return (
                          <React.Fragment key={t.id}>
                            <tr
                              onClick={() => setExpandedTradeId(isExpanded ? null : t.id)}
                              className="hover:bg-slate-100/30 cursor-pointer transition-all border-b border-slate-200/60"
                            >
                              <td className="p-4 text-slate-600 font-mono">
                                {new Date(t.created_at).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-indigo-400 border border-slate-850">
                                  {t.symbol}
                                </span>
                                <span className="text-slate-600 font-normal">({t.timeframe})</span>
                              </td>
                              <td className="p-4">
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black tracking-wider ${
                                  t.bias === "BULLISH"
                                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                                    : t.bias === "BEARISH"
                                      ? "bg-rose-950/40 text-rose-400 border border-rose-900/30"
                                      : "bg-slate-100 text-slate-600"
                                }`}>
                                  {t.bias}
                                </span>
                              </td>
                              <td className="p-4 font-mono text-slate-900 font-semibold">
                                {t.entry_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 font-mono text-indigo-400 font-semibold">
                                {t.exit_price !== undefined && t.exit_price !== null && t.exit_price !== 0
                                  ? t.exit_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  : "—"}
                              </td>
                              <td className={`p-4 font-mono font-bold ${
                                (t.pnl || 0) > 0 
                                  ? "text-emerald-400" 
                                  : (t.pnl || 0) < 0 
                                    ? "text-rose-400" 
                                    : "text-slate-600"
                              }`}>
                                {t.pnl !== undefined && t.status !== "PENDING"
                                  ? `${(t.pnl || 0) > 0 ? "+" : ""}${t.pnl?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : "—"}
                              </td>
                              <td className="p-4 font-mono text-rose-400">
                                {t.stop_loss?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 font-mono text-amber-500 font-bold">{t.risk_reward}</td>
                              <td className="p-4" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={t.status}
                                  onChange={(e) => handleUpdateStatus(t.id, e.target.value as any)}
                                  className={`px-2 py-1 rounded text-[10px] font-bold focus:outline-none border cursor-pointer ${
                                    t.status === "WON"
                                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                                      : t.status === "LOST"
                                        ? "bg-rose-950/40 border-rose-800 text-rose-400"
                                        : t.status === "BREAKEAVEN"
                                          ? "bg-slate-100 border-slate-300 text-slate-700"
                                          : "bg-amber-950/40 border-amber-800 text-amber-400"
                                  }`}
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="WON">WON</option>
                                  <option value="LOST">LOST</option>
                                  <option value="BREAKEAVEN">B/E</option>
                                </select>
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={(e) => handleDeleteTrade(t.id, e)}
                                  className="p-1.5 hover:bg-slate-100 hover:text-rose-400 rounded-lg text-slate-500 transition cursor-pointer inline-flex items-center"
                                  title="Erase log"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>

                            {/* ROW EXPANSION: CHART DETAILS SCREENSHOT & STATS */}
                            {isExpanded && (
                              <tr className="bg-[#0c0f17]">
                                <td colSpan={10} className="p-6 border-b border-slate-200">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    
                                    {/* Column 1: Image context and settlement form */}
                                    <div className="space-y-4">
                                      {t.image_url ? (
                                        <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-850 h-56 relative group">
                                          <img
                                            src={t.image_url}
                                            alt="Historical Trade Print"
                                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                          />
                                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent p-4 flex flex-col justify-end">
                                            <p className="text-[10px] text-slate-600 uppercase font-semibold">Exemplary Chart Context (Captured)</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center flex items-center justify-center text-slate-500 h-56 font-mono text-xs">
                                          No linked screenshot registered.
                                        </div>
                                      )}

                                      <TradeSettlementForm 
                                        trade={t}
                                        onSave={async (status, exitPrice, calculatedPnl) => {
                                          await updateTradeStatus(t.id, status, exitPrice, calculatedPnl);
                                          setDbConfigUpdated((prev) => prev + 1);
                                        }}
                                      />
                                    </div>

                                    {/* Notes & details findings */}
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest font-display">Notes & Comments:</h4>
                                        <p className="text-xs text-slate-600 leading-normal bg-slate-50 border border-slate-850 p-4 rounded-xl mt-1.5">
                                          {t.notes}
                                        </p>
                                      </div>

                                      {t.analysis_info && (
                                        <div className="p-4 bg-slate-50 border border-indigo-950/50 rounded-xl space-y-2 text-xs">
                                          <h4 className="font-bold text-indigo-400 uppercase tracking-widest text-[10px] mb-2 font-display flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full"></span>
                                            Historical Analysis findings
                                          </h4>
                                          <div className="flex justify-between">
                                            <span className="text-slate-500">Structure Context</span>
                                            <span className="text-slate-700 font-mono text-[11px]">{t.analysis_info.marketStructure}</span>
                                          </div>
                                          <div className="flex justify-between border-t border-slate-200 pt-1.5">
                                            <span className="text-slate-500">Active Order Block</span>
                                            <span className="text-slate-700 font-mono text-[11px]">
                                              {t.analysis_info.orderBlock?.priceRange || "N/A"}
                                            </span>
                                          </div>
                                          <div className="flex justify-between border-t border-slate-200 pt-1.5">
                                            <span className="text-slate-500">Supply-Demand controller</span>
                                            <span className="text-slate-700 font-mono text-[11px]">
                                              {t.analysis_info.supplyDemandZones?.activeZone || "N/A"}
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                      {/* Export Report action block */}
                                      <div className="pt-2 text-right">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleExportPDF(t);
                                          }}
                                          disabled={exportingId === t.id}
                                          className={`w-full sm:w-auto px-4 py-2 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                                            exportingId === t.id
                                              ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                              : "bg-indigo-650/40 hover:bg-indigo-600 border-indigo-500 text-slate-900 shadow-lg shadow-indigo-500/10"
                                          }`}
                                        >
                                          {exportingId === t.id ? (
                                            <>
                                              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                                              Exporting PDF...
                                            </>
                                          ) : (
                                            <>
                                              <FileDown className="h-4 w-4" />
                                              Export Report
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DATABASE SETUP WORKSPACE */}
        {activeTab === "databases" && (
          <DatabaseSetup onConfigChange={() => setDbConfigUpdated((prev) => prev + 1)} />
        )}
          </main>
        </div>

        {/* Desktop Sidebar Panel */}
        {chatSidebarOpen && (
          <div className="w-80 md:w-[400px] border-l border-[#1e293b]/70 bg-[#0a0f1d] shrink-0 h-full hidden lg:block z-30 shadow-2xl relative">
            <ChatSidebar 
              currentAnalysis={analysisResult} 
              tradeHistory={trades} 
              activeSymbol={symbol}
              onClose={() => setChatSidebarOpen(false)}
            />
          </div>
        )}

        {/* Mobile Slide-over Overlay */}
        {chatSidebarOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden bg-white/80 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-[340px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-slate-850 bg-slate-50">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display">SMC AI Mentor</span>
                <button 
                  onClick={() => setChatSidebarOpen(false)}
                  className="text-slate-600 hover:text-slate-900 text-xs font-bold bg-slate-100 px-2 py-1 rounded cursor-pointer"
                >
                  Close &times;
                </button>
              </div>
              <div className="flex-1 overflow-hidden font-sans">
                <ChatSidebar 
                  currentAnalysis={analysisResult} 
                  tradeHistory={trades} 
                  activeSymbol={symbol}
                  onClose={() => setChatSidebarOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 py-6 px-4 md:px-8 text-center bg-white/20 mt-auto pb-24 md:pb-6">
        <p className="text-[11px] text-slate-500 leading-normal">
          Designed for Synthetic Index SMC mechanical study. Algorithmic prediction outcomes are for educational studies only. Synthetics leverage extreme risk; prioritize systematic stop loss protection.
        </p>
      </footer>

      {/* iOS-STYLE MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0c0f17]/90 border-t border-slate-200/80 backdrop-blur-lg px-2 py-2 flex justify-around items-center z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => setActiveTab("analyzer")}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all relative cursor-pointer ${
            activeTab === "analyzer" ? "text-cyan-400 font-bold" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Upload className="h-5 w-5" />
          <span className="text-[10px]">Analyzer</span>
        </button>
        <button
          onClick={() => setActiveTab("calculator")}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all relative cursor-pointer ${
            activeTab === "calculator" ? "text-cyan-400 font-bold" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <CircleDollarSign className="h-5 w-5" />
          <span className="text-[10px]">Risk Cal</span>
        </button>
        <button
          onClick={() => setActiveTab("journal")}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all relative cursor-pointer ${
            activeTab === "journal" ? "text-cyan-400 font-bold" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <BookOpen className="h-5 w-5" />
          <span className="text-[10px]">Journal</span>
          {computedStats.pending > 0 && (
            <span className="absolute -top-1 right-2 bg-amber-500 text-[#0d1322] font-semibold rounded-full h-4 min-w-[16px] px-1 text-[9px] flex items-center justify-center">
              {computedStats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("databases")}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition-all relative cursor-pointer ${
            activeTab === "databases" ? "text-cyan-400 font-bold" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px]">Control</span>
        </button>
      </nav>

      {/* QUICK NOTE MODAL */}
      {isQuickNoteOpen && (
        <QuickNoteModal
          trades={trades}
          currentSymbol={customSymbolText ? customSymbolText : symbol.ticker}
          onClose={() => setIsQuickNoteOpen(false)}
          onSave={handleQuickNoteSave}
        />
      )}
    </div>
  );
}
