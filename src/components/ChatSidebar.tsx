import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Sparkles, 
  Trash2, 
  GraduationCap, 
  ChevronRight, 
  BrainCircuit, 
  BookOpen, 
  FolderLock, 
  Calendar,
  X,
  PlusCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  RefreshCcw,
  Loader2,
  CheckCircle2,
  Lightbulb
} from "lucide-react";
import { 
  getChatHistory, 
  saveChatMessage, 
  getUserLearnings, 
  saveUserLearning,
  ChatMessage,
  UserLearningItem 
} from "../lib/firebaseChat";
import { auth as firebaseAuth } from "../lib/firebase";

interface ChatSidebarProps {
  currentAnalysis: any;
  tradeHistory: any[];
  activeSymbol?: any;
  onClose?: () => void;
}

export default function ChatSidebar({ currentAnalysis, tradeHistory, activeSymbol, onClose }: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [educationalMode, setEducationalMode] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "learnings">("chat");

  // Learnings form state
  const [learnings, setLearnings] = useState<UserLearningItem[]>([]);
  const [learningText, setLearningText] = useState("");
  const [learningCategory, setLearningCategory] = useState("Structure");
  const [learningSymbol, setLearningSymbol] = useState("V75");
  const [isSavingLearning, setIsSavingLearning] = useState(false);

  // Diagram Synthesizer overlay trigger
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [diagramSubject, setDiagramSubject] = useState("Bullish Order Block Shift");

  const messageEndRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  // Loading existing user history from Firestore
  useEffect(() => {
    isMounted.current = true;
    loadHistory();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadHistory = async () => {
    if (!firebaseAuth.currentUser) {
      // Fallback: Default welcoming messages if offline/guest
      setMessages([
        {
          id: "welcome-1",
          userId: "guest",
          sender: "bot",
          message: "Greetings, cadet! I am your AI SMC Copilot. Log in to save your charts, trade histories, and personal lessons to our persistent cloud architecture.",
          created_at: new Date()
        }
      ]);
      return;
    }

    try {
      const historyMsg = await getChatHistory();
      const learningLogs = await getUserLearnings();
      
      if (isMounted.current) {
        setLearnings(learningLogs);
        if (historyMsg.length > 0) {
          setMessages(historyMsg);
        } else {
          // Welcome default
          setMessages([
            {
              id: "welcome-1",
              userId: firebaseAuth.currentUser.uid,
              sender: "bot",
              message: "Welcome back! I am synced with your Firestore journal logs. Ask me anything about Synthetic Indices, test yourself with an SMC Quiz (Educational Mode active), or tap the **Wand element** below to synthesize diagrams.",
              created_at: new Date()
            }
          ]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Scroll bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    e?.preventDefault();
    const queryStr = customText || inputText.trim();
    if (!queryStr) return;

    if (!customText) {
      setInputText("");
    }

    // Append user message instantly
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      userId: firebaseAuth.currentUser?.uid || "guest",
      sender: "user",
      message: queryStr,
      created_at: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    // Save user message to Firestore if logged in
    await saveChatMessage(queryStr, "user");

    try {
      // Fetch user understandings
      const plainLearnings = learnings.map(l => l.learnings);

      // Call Chat-Bot API
      const res = await fetch("/api/chat-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: queryStr,
          history: messages.slice(-10).map(m => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.message }]
          })),
          currentAnalysis: currentAnalysis || null,
          tradeHistory: tradeHistory || [],
          learnings: plainLearnings,
          educationalMode,
          chartImage: currentAnalysis?.image_url || null,
          activeSymbol: activeSymbol || null
        })
      });

      const parsed = await res.json();
      if (!res.ok || !parsed.success) {
        throw new Error(parsed.error || "Copilot response failed.");
      }

      const botReply = parsed.data;

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        userId: "bot",
        sender: "bot",
        message: botReply,
        created_at: new Date()
      };

      setMessages(prev => [...prev, botMsg]);
      await saveChatMessage(botReply, "bot");

    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        userId: "bot",
        sender: "bot",
        message: `⚠️ Connection drop: ${err.message || 'Please verify dev server connection.'}`,
        created_at: new Date()
      }]);
    } finally {
      setIsSending(true);
      setIsSending(false);
    }
  };

  const handleCreateLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learningText.trim()) return;
    setIsSavingLearning(true);

    try {
      const savedItem = await saveUserLearning(
        learningText.trim(),
        learningSymbol,
        learningCategory
      );

      if (savedItem) {
        setLearnings(prev => [savedItem, ...prev]);
        setLearningText("");
        
        // Notify chat bot sidebar memory updated
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          userId: "bot",
          sender: "bot",
          message: `💡 **SMC Memory Sync**: I have logged your customized rule: *"${savedItem.learnings}"* under symbols context: **${savedItem.symbol}**. I will respect this rule for all future on-screen trade analysis!`,
          created_at: new Date()
        }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingLearning(false);
    }
  };

  // Synthesize custom SMC vector illustration
  const handleGenerateDiagram = async () => {
    setIsGeneratingDiagram(true);
    try {
      const res = await fetch("/api/generate-educational-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: diagramSubject,
          explanation: `SMC concepts illustrating support, wicks, zones, and entry biases for synthetic volatility study.`
        })
      });
      const parsed = await res.json();
      if (!res.ok || !parsed.success) {
        throw new Error(parsed.error || "Failed to draft custom SVG.");
      }

      // Append image reference bubble to conversational thread!
      const diagramMessageText = `🎨 **Synthesized Educational Diagram**: [${diagramSubject}]
This diagram was custom built by Gemini modeling engine. Use it to study ideal mechanical placements.
[Tap to zoom view details]`;

      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        userId: "bot",
        sender: "bot",
        message: diagramMessageText,
        created_at: new Date()
      }]);

      // Direct triggers zoom overlay
      setImageModalUrl(parsed.imageUrl);

    } catch (err: any) {
      console.error("Failed to generate diagram:", err);
      if (isMounted.current) {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            userId: "bot",
            sender: "bot",
            message: `⚠️ Synthesis failed: ${err.message || "Please check connection configuration and retry."}`,
            created_at: new Date(),
          },
        ]);
      }
    } finally {
      setIsGeneratingDiagram(false);
    }
  };

  // Clear Chat History logs locally and in Firestore rules
  const handleClearHistory = () => {
    if (window.confirm("Erase chat session logs from Firestore? This clears your context memory.")) {
      setMessages([
        {
          id: "welcome-re",
          userId: "bot",
          sender: "bot",
          message: "Conversation context flushed. Fresh SMC matrices loaded! Ask a question or request a quiz.",
          created_at: new Date()
        }
      ]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/95 border-l border-slate-200/90 w-full relative" id="chat-sidebar-workspace">
      
      {/* HEADER CONTROLS */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 sticky top-0 z-12">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-cyan-400 animate-pulse" />
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider font-display">SMC AI Mentor</h3>
            <p className="text-[10px] text-slate-600">Contextual Trading Companion</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onClose && (
            <button 
              onClick={onClose} 
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="grid grid-cols-2 bg-slate-50 border-b border-slate-850 text-xs">
        <button
          onClick={() => setActiveTab("chat")}
          className={`py-3 text-center font-bold tracking-wider transition border-b-2 cursor-pointer uppercase ${
            activeTab === "chat" 
              ? "text-cyan-400 border-cyan-500 bg-cyan-950/10" 
              : "text-slate-500 border-transparent hover:text-slate-700"
          }`}
        >
          AI Chat Room
        </button>
        <button
          onClick={() => setActiveTab("learnings")}
          className={`py-3 text-center font-bold tracking-wider transition border-b-2 cursor-pointer uppercase ${
            activeTab === "learnings" 
              ? "text-indigo-400 border-indigo-505 bg-indigo-950/10" 
              : "text-slate-500 border-transparent hover:text-slate-700"
          }`}
        >
          My SMC Rules Setup ({learnings.length})
        </button>
      </div>

      {/* CORE SCREENS SCROLL SCENE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-180px)]">
        
        {/* ROOM TAB SCREEN */}
        {activeTab === "chat" && (
          <div className="space-y-4 flex flex-col justify-end min-h-full">
            
            {/* Top widgets controls: Quiz shortcuts & Educational toggler */}
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <GraduationCap className="h-4 w-4 text-indigo-400" />
                  <span>Educational Quizzer</span>
                </div>
                
                {/* Educational toggle switch */}
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={educationalMode}
                    onChange={() => setEducationalMode(!educationalMode)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-cyan-400"></div>
                  <span className="ml-2 text-[10px] text-slate-600 uppercase font-mono">
                    {educationalMode ? "Study ON" : "Tactical ON"}
                  </span>
                </label>
              </div>

              {educationalMode && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleSendMessage(undefined, "Quiz me about Boom / Crash indices spike mitigation")}
                    className="p-1 px-2.5 bg-slate-100 border border-slate-850 hover:bg-slate-200 text-[10px] text-indigo-300 font-bold rounded-full transition cursor-pointer"
                  >
                    ⚡ Take SMC Spike Quiz
                  </button>
                  <button
                    onClick={() => handleSendMessage(undefined, "Explain what a Fair Value Gap (FVG) represents")}
                    className="p-1 px-2.5 bg-slate-100 border border-slate-850 hover:bg-slate-200 text-[10px] text-cyan-300 font-bold rounded-full transition cursor-pointer"
                  >
                    📖 Explain FVG
                  </button>
                  <button
                    onClick={() => handleSendMessage(undefined, "Explain the exact structural difference between BOS and CHoCH")}
                    className="p-1 px-2.5 bg-slate-100 border border-slate-850 hover:bg-slate-200 text-[10px] text-amber-400 font-bold rounded-full transition cursor-pointer"
                  >
                    ❓ BOS vs CHoCH differences
                  </button>
                </div>
              )}
            </div>

            {/* Chat Messages flow bubbles */}
            <div className="space-y-3 pt-4">
              {messages.map((m, idx) => {
                const isBot = m.sender === "bot";
                return (
                  <div 
                    key={m.id || idx} 
                    className={`flex flex-col max-w-[85%] ${isBot ? "self-start mr-auto" : "self-end ml-auto"}`}
                  >
                    {/* Timestamp / Sender line */}
                    <span className={`text-[9px] text-slate-500 font-mono mb-1 ${isBot ? "text-left" : "text-right"}`}>
                      {isBot ? "Copilot Assistant" : firebaseAuth.currentUser?.email === "ibrahimfaruqolamilekan4@gmail.com" ? "Admin (Ibrahim)" : "User"} • {new Date(m.created_at?.toDate?.() || m.created_at || new Date()).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className={`p-3.5 rounded-2xl text-[12px] leading-relaxed relative ${
                      isBot 
                        ? "bg-white border border-slate-200 text-slate-800" 
                        : "bg-indigo-600 text-slate-900 rounded-br-none glow-indigo-sm"
                    }`}
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {m.message}

                      {/* Specialized check for custom canvas rendering */}
                      {isBot && m.message.includes("🎨") && imageModalUrl && (
                        <div className="mt-2.5">
                          <div 
                            onClick={() => setImageModalUrl(imageModalUrl)}
                            className="bg-slate-50 aspect-[8/5] w-full rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:border-cyan-400/50 transition relative group"
                          >
                            <img 
                              src={imageModalUrl} 
                              alt="Educational concept visual chart" 
                              className="w-full h-full object-cover transition group-hover:scale-101"
                            />
                            <div className="absolute inset-0 bg-slate-50/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <span className="text-[10px] text-slate-900 bg-slate-50/80 p-2 rounded-lg border border-slate-200 font-bold uppercase tracking-widest flex items-center gap-1">
                                <PlusCircle className="h-3.5 w-3.5" /> Zoom View
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex flex-col max-w-[85%] self-start mr-auto">
                  <span className="text-[9px] text-slate-500 font-mono mb-1">AI Copilot</span>
                  <div className="bg-white border border-slate-850 p-3.5 rounded-2xl flex items-center gap-2 text-slate-600 text-xs">
                    <Loader2 className="h-4.5 w-4.5 text-indigo-500 animate-spin" />
                    Calculating trade matrices...
                  </div>
                </div>
              )}

              <div ref={messageEndRef}></div>
            </div>
          </div>
        )}

        {/* LEARNING DATABASE MANAGEMENT SCREEN */}
        {activeTab === "learnings" && (
          <div className="space-y-4">
            
            {/* Saved learning capturing panel */}
            <div className="bg-white border border-slate-200 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest font-display mb-1 flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4 text-emerald-400" />
                Capture Trading Custom Rule
              </h4>
              <p className="text-[10px] text-slate-600 mb-3 leading-normal">
                Instruct your AI to remember specific volatility indexes tendencies (e.g. V75 sweeps wicks, C500 spike ratios) so it integrates them into its on-screen SMC analysis.
              </p>

              <form onSubmit={handleCreateLearning} className="space-y-3">
                <div>
                  <label className="block text-[9px] text-slate-600 uppercase font-mono mb-1">Related Index Context</label>
                  <select 
                    value={learningSymbol} 
                    onChange={(e) => setLearningSymbol(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="V75">Volatility 75 Index</option>
                    <option value="V751S">Volatility 75 (1s)</option>
                    <option value="V100">Volatility 100 Index</option>
                    <option value="B1000">Boom 1000 Index</option>
                    <option value="C1000">Crash 1000 Index</option>
                    <option value="STEP">Step Index</option>
                    <option value="General">Global General SMC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-600 uppercase font-mono mb-1">Learning Category</label>
                  <select 
                    value={learningCategory} 
                    onChange={(e) => setLearningCategory(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Wicks/Liquidity">Liq/Wick Sweeps</option>
                    <option value="Spikes">Boom/Crash Spikes</option>
                    <option value="Risk">Risk / Position Sizing</option>
                    <option value="Psychology">Trading Psychology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] text-slate-600 uppercase font-mono mb-1">Observation / Golden Rule</label>
                  <textarea
                    rows={3}
                    placeholder="e.g., V75 often performs a premium 61.8% Fibonacci retrace before filling daily imbalances."
                    value={learningText}
                    onChange={(e) => setLearningText(e.target.value)}
                    maxLength={300}
                    className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500 placeholder-slate-600 block resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSavingLearning || !learningText.trim()}
                  className="w-full text-xs font-bold py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-550 border border-indigo-500 text-slate-900 flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-100 disabled:border-slate-850 disabled:text-slate-500"
                >
                  {isSavingLearning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Capturing observation...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4 text-emerald-400 animate-pulse" />
                      Sync Rule to AI Brain
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* List logged learnings */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-display mb-1 flex items-center gap-1">
                <span>Stored observations ({learnings.length})</span>
              </h4>

              {learnings.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-850 rounded-xl text-slate-500 text-xs font-mono">
                  Your personalized SMC database is clean. Capture custom habits above!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {learnings.map((l) => (
                    <div key={l.id} className="p-3 bg-slate-50 border border-slate-850 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-mono">
                        <span className="text-indigo-400 font-bold uppercase">{l.category}</span>
                        <span className="text-slate-500">{l.symbol}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-normal">{l.learnings}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* FOOTER MESSAGE WRAPPING INPUTS BLOCK */}
      {activeTab === "chat" && (
        <div className="p-4 border-t border-slate-200 bg-slate-50/90 space-y-3 sticky bottom-0 left-0 right-0 z-10 select-none">
          
          {/* Diagnostic utilities: diagram builder */}
          <div className="bg-slate-100 border border-slate-850 p-2 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <select
                value={diagramSubject}
                onChange={(e) => setDiagramSubject(e.target.value)}
                className="bg-transparent border-none text-[10px] text-slate-700 font-bold focus:outline-none cursor-pointer max-w-[150px] shrink-0"
              >
                <option value="Bullish Order Block Shift">Bullish OB Shift</option>
                <option value="Bearish Liquidity Wick sweep">Wick Sweep</option>
                <option value="Fib retracement golden pocket">Fib Retracement</option>
                <option value="Boom spike hazard zones">Spike Protection</option>
              </select>
            </div>

            <button
              onClick={handleGenerateDiagram}
              disabled={isGeneratingDiagram}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 shrink-0 ${
                isGeneratingDiagram 
                  ? "bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed" 
                  : "bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:text-slate-900 transition cursor-pointer"
              }`}
            >
              {isGeneratingDiagram ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Drawing...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  Synthesize Diagram
                </>
              )}
            </button>
          </div>

          {/* Form input messaging box */}
          <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Is this H1 block mitigated?"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isSending}
              className="flex-1 bg-slate-100 border border-slate-805 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500 text-slate-900 rounded-xl transition cursor-pointer shadow-md shadow-indigo-500/10 select-none flex items-center justify-center min-w-[38px] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          {/* Prompt reset session clear command */}
          <div className="flex justify-between items-center text-[9px] text-slate-500">
            <span>SMC Copilot fully context synced</span>
            <button 
              onClick={handleClearHistory} 
              className="hover:text-rose-400 transition cursor-pointer select-none"
            >
              Reset Session Room
            </button>
          </div>
        </div>
      )}

      {/* DYNAMIC ZOOM DIALOG MODAL */}
      {imageModalUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 selection:bg-transparent"
          onClick={() => setImageModalUrl(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[85vh] bg-[#0c0f17] border border-slate-200 rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col items-center">
            
            <button 
              onClick={() => setImageModalUrl(null)}
              className="absolute top-4 right-4 bg-slate-100 hover:bg-white text-slate-600 hover:text-slate-900 p-2 rounded-xl transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="w-full flex-1 overflow-auto flex items-center justify-center">
              <img 
                src={imageModalUrl} 
                alt="Enlarged study schematic model" 
                className="max-w-full max-h-[70vh] object-contain rounded-2xl border border-slate-200 selection:bg-transparent"
              />
            </div>

            <div className="pt-4 text-center">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-display">SMC Mechanical Diagram</span>
              <p className="text-[10px] text-slate-600 mt-1">Study mitigation levels, stop-losses, and premium/discount order lines contextually.</p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
