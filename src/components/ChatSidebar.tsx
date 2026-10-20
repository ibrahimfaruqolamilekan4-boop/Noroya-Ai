import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  GraduationCap,
  BrainCircuit,
  X,
  PlusCircle,
  Loader2,
  Lightbulb,
} from "lucide-react";
import {
  getChatHistory,
  saveChatMessage,
  getUserLearnings,
  saveUserLearning,
  ChatMessage,
  UserLearningItem,
} from "../lib/firebaseChat";
import { auth as firebaseAuth } from "../lib/firebase";

interface ChatSidebarProps {
  currentAnalysis: any;
  tradeHistory: any[];
  activeSymbol?: any;
  onClose?: () => void;
}

export default function ChatSidebar({
  currentAnalysis,
  tradeHistory,
  activeSymbol,
  onClose,
}: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [educationalMode, setEducationalMode] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "learnings">("chat");

  const [learnings, setLearnings] = useState<UserLearningItem[]>([]);
  const [learningText, setLearningText] = useState("");
  const [learningCategory, setLearningCategory] = useState("Structure");
  const [learningSymbol, setLearningSymbol] = useState("V75");
  const [isSavingLearning, setIsSavingLearning] = useState(false);

  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [diagramSubject, setDiagramSubject] = useState("Bullish Order Block Shift");

  const messageEndRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    loadHistory();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadHistory = async () => {
    if (!firebaseAuth.currentUser) {
      setMessages([
        {
          id: "welcome-1",
          userId: "guest",
          sender: "bot",
          message:
            "Welcome to QuantSMC Copilot. Ask about market structure, ICT Killzones, 0.705 OTE retracements, Crypto Perpetuals CVD/OI flushes, or Synthetic Indices spike bases.",
          created_at: new Date(),
        },
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
          setMessages([
            {
              id: "welcome-1",
              userId: firebaseAuth.currentUser.uid,
              sender: "bot",
              message:
                "Synced with your Firestore journal logs. Ask about Forex Killzones, Synthetic Indices, or Crypto Perpetuals orderflow.",
              created_at: new Date(),
            },
          ]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

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

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      userId: firebaseAuth.currentUser?.uid || "guest",
      sender: "user",
      message: queryStr,
      created_at: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    saveChatMessage(queryStr, "user").catch((e) =>
      console.warn("Firestore save message error:", e)
    );

    try {
      const plainLearnings = learnings.map((l) => l.learnings);

      let safeChartImage: string | null = null;
      if (
        currentAnalysis?.image_url &&
        typeof currentAnalysis.image_url === "string" &&
        currentAnalysis.image_url.length < 1500000
      ) {
        safeChartImage = currentAnalysis.image_url;
      }

      const res = await fetch(`/api/chat-bot?_t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify({
          prompt: queryStr,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            parts: [{ text: m.message }],
          })),
          currentAnalysis: currentAnalysis || null,
          tradeHistory: tradeHistory || [],
          learnings: plainLearnings,
          educationalMode,
          chartImage: safeChartImage,
          activeSymbol: activeSymbol || null,
        }),
      });

      const parsed = await res.json();
      if (!res.ok || !parsed.success) {
        throw new Error(parsed.error || `Copilot response failed (${res.status})`);
      }

      const botReply = parsed.data || "I analyzed your question, but could not produce a response.";

      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        userId: "bot",
        sender: "bot",
        message: botReply,
        created_at: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
      saveChatMessage(botReply, "bot").catch((e) =>
        console.warn("Firestore save bot reply error:", e)
      );
    } catch (err: any) {
      console.error("AI Copilot request error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          userId: "bot",
          sender: "bot",
          message: `Connection notice: ${err.message || "Please check your network connection."}`,
          created_at: new Date(),
        },
      ]);
    } finally {
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
        setLearnings((prev) => [savedItem, ...prev]);
        setLearningText("");

        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            userId: "bot",
            sender: "bot",
            message: `SMC Memory Sync: Logged custom rule "${savedItem.learnings}" under ${savedItem.symbol}.`,
            created_at: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingLearning(false);
    }
  };

  const handleGenerateDiagram = async () => {
    setIsGeneratingDiagram(true);
    try {
      const res = await fetch(`/api/generate-educational-image?_t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify({
          subject: diagramSubject,
          explanation: `SMC concepts illustrating support, wicks, zones, and entry biases for quantitative study.`,
        }),
      });
      const parsed = await res.json();
      if (!res.ok || !parsed.success) {
        throw new Error(parsed.error || "Failed to draft custom SVG.");
      }

      const diagramMessageText = `Synthesized Educational Diagram: [${diagramSubject}]\nTap to inspect schematic details.`;

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          userId: "bot",
          sender: "bot",
          message: diagramMessageText,
          created_at: new Date(),
        },
      ]);

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
            message: `Synthesis failed: ${err.message || "Please retry."}`,
            created_at: new Date(),
          },
        ]);
      }
    } finally {
      setIsGeneratingDiagram(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm("Erase chat session logs?")) {
      setMessages([
        {
          id: "welcome-re",
          userId: "bot",
          sender: "bot",
          message: "Conversation context reset. Ask any SMC or multi-asset question.",
          created_at: new Date(),
        },
      ]);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-slate-200 w-full relative text-slate-900"
      id="chat-sidebar-workspace"
    >
      {/* HEADER CONTROLS */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <BrainCircuit className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 font-display">
              QuantSMC AI Mentor
            </h3>
            <p className="text-[11px] text-slate-500">Contextual Quantitative Companion</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* TABS NAVIGATION */}
      <div className="grid grid-cols-2 bg-[#F8FAF9] border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab("chat")}
          className={`py-2.5 text-center font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "chat"
              ? "text-emerald-700 border-emerald-600 bg-white"
              : "text-slate-500 border-transparent hover:text-slate-900"
          }`}
        >
          AI Desk Chat
        </button>
        <button
          onClick={() => setActiveTab("learnings")}
          className={`py-2.5 text-center font-semibold transition border-b-2 cursor-pointer ${
            activeTab === "learnings"
              ? "text-emerald-700 border-emerald-600 bg-white"
              : "text-slate-500 border-transparent hover:text-slate-900"
          }`}
        >
          Custom Rules ({learnings.length})
        </button>
      </div>

      {/* CORE SCREENS SCROLL SCENE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-180px)] bg-[#F8FAF9]">
        {activeTab === "chat" && (
          <div className="space-y-4 flex flex-col justify-end min-h-full">
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <GraduationCap className="h-4 w-4 text-emerald-600" />
                  <span>Quick Institutional Prompts</span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={educationalMode}
                    onChange={() => setEducationalMode(!educationalMode)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                  <span className="ml-2 text-[11px] text-slate-600 font-mono">
                    {educationalMode ? "Prompts" : "Minimal"}
                  </span>
                </label>
              </div>

              {educationalMode && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    onClick={() =>
                      handleSendMessage(
                        undefined,
                        "How do I prevent my Stop Loss from getting swept on Forex & Gold?"
                      )
                    }
                    className="px-2.5 py-1 bg-[#F8FAF9] border border-slate-200 hover:border-emerald-600 text-[11px] text-slate-700 hover:text-emerald-700 font-medium rounded-md transition cursor-pointer"
                  >
                    Stop Loss Protection
                  </button>
                  <button
                    onClick={() =>
                      handleSendMessage(
                        undefined,
                        "Explain London Judas Swing manipulation and Asian liquidity sweeps"
                      )
                    }
                    className="px-2.5 py-1 bg-[#F8FAF9] border border-slate-200 hover:border-emerald-600 text-[11px] text-slate-700 hover:text-emerald-700 font-medium rounded-md transition cursor-pointer"
                  >
                    London Judas Swing
                  </button>
                  <button
                    onClick={() =>
                      handleSendMessage(
                        undefined,
                        "Explain what a Fair Value Gap (FVG) represents and how to enter on OTE 0.705"
                      )
                    }
                    className="px-2.5 py-1 bg-[#F8FAF9] border border-slate-200 hover:border-emerald-600 text-[11px] text-slate-700 hover:text-emerald-700 font-medium rounded-md transition cursor-pointer"
                  >
                    FVG &amp; 0.705 OTE Entry
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              {messages.map((m, idx) => {
                const isBot = m.sender === "bot";
                return (
                  <div
                    key={m.id || idx}
                    className={`flex flex-col max-w-[88%] ${
                      isBot ? "self-start mr-auto" : "self-end ml-auto"
                    }`}
                  >
                    <span
                      className={`text-[10px] text-slate-500 font-mono mb-1 ${
                        isBot ? "text-left" : "text-right"
                      }`}
                    >
                      {isBot ? "QuantSMC Copilot" : "Trader"} ·{" "}
                      {new Date(
                        m.created_at?.toDate?.() || m.created_at || new Date()
                      ).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <div
                      className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                        isBot
                          ? "bg-white border border-slate-200 text-slate-800"
                          : "bg-emerald-600 text-white rounded-br-none"
                      }`}
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {m.message}

                      {isBot && m.message.includes("Synthesized Educational Diagram") && imageModalUrl && (
                        <div className="mt-2.5">
                          <div
                            onClick={() => setImageModalUrl(imageModalUrl)}
                            className="bg-[#F8FAF9] aspect-[8/5] w-full rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-emerald-600 transition relative"
                          >
                            <img
                              src={imageModalUrl}
                              alt="Educational concept visual chart"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isSending && (
                <div className="flex flex-col max-w-[85%] self-start mr-auto">
                  <span className="text-[10px] text-slate-500 font-mono mb-1">QuantSMC Copilot</span>
                  <div className="bg-white border border-slate-200 p-3.5 rounded-xl flex items-center gap-2 text-slate-600 text-xs">
                    <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
                    Evaluating market structure...
                  </div>
                </div>
              )}

              <div ref={messageEndRef}></div>
            </div>
          </div>
        )}

        {activeTab === "learnings" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl">
              <h4 className="text-xs font-bold text-slate-900 font-display mb-1 flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4 text-emerald-600" />
                Save Custom Trading Rule
              </h4>
              <p className="text-xs text-slate-600 mb-3 leading-normal">
                Store asset-specific behaviors so the AI analyzer incorporates them during chart evaluations.
              </p>

              <form onSubmit={handleCreateLearning} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Instrument</label>
                  <select
                    value={learningSymbol}
                    onChange={(e) => setLearningSymbol(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F8FAF9] border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="EURUSD">EUR/USD</option>
                    <option value="BTCUSDT.P">BTCUSDT.P</option>
                    <option value="V75">Volatility 75 Index</option>
                    <option value="B1000">Boom 1000 Index</option>
                    <option value="C500">Crash 500 Index</option>
                    <option value="General">Global SMC Rule</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Category</label>
                  <select
                    value={learningCategory}
                    onChange={(e) => setLearningCategory(e.target.value)}
                    className="w-full text-xs p-2 bg-[#F8FAF9] border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="Wicks/Liquidity">Liquidity Sweeps</option>
                    <option value="Spikes">Boom/Crash Spikes</option>
                    <option value="Risk">Risk / Position Sizing</option>
                    <option value="Structure">Market Structure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Rule Description</label>
                  <textarea
                    rows={3}
                    placeholder="e.g., Wait for a 15M liquidity sweep and CHoCH inside the 0.705 OTE zone."
                    value={learningText}
                    onChange={(e) => setLearningText(e.target.value)}
                    maxLength={300}
                    className="w-full text-xs p-2.5 bg-[#F8FAF9] border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingLearning || !learningText.trim()}
                  className="w-full text-xs font-semibold py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingLearning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Rule...</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4" />
                      <span>Save Rule to Memory</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-700">
                Saved Observations ({learnings.length})
              </h4>

              {learnings.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-300 bg-white rounded-xl text-slate-500 text-xs">
                  No custom rules stored yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {learnings.map((l) => (
                    <div key={l.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                      <div className="flex justify-between items-center text-[11px] font-mono">
                        <span className="text-emerald-700 font-semibold">{l.category}</span>
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

      {/* FOOTER MESSAGE INPUT */}
      {activeTab === "chat" && (
        <div className="p-4 border-t border-slate-200 bg-white space-y-3 sticky bottom-0 left-0 right-0 z-10">
          <div className="bg-[#F8FAF9] border border-slate-200 p-2 rounded-lg flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <select
                value={diagramSubject}
                onChange={(e) => setDiagramSubject(e.target.value)}
                className="bg-transparent border-none text-xs text-slate-800 font-medium focus:outline-none cursor-pointer truncate"
              >
                <option value="Bullish Order Block Shift">Bullish OB Shift</option>
                <option value="Bearish Liquidity Wick sweep">Liquidity Sweep</option>
                <option value="Fib retracement golden pocket">0.705 OTE Retracement</option>
                <option value="Boom spike hazard zones">Boom/Crash Spike Base</option>
              </select>
            </div>

            <button
              onClick={handleGenerateDiagram}
              disabled={isGeneratingDiagram}
              className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 transition cursor-pointer shrink-0 flex items-center gap-1"
            >
              {isGeneratingDiagram ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Drawing...</span>
                </>
              ) : (
                <span>Diagram</span>
              )}
            </button>
          </div>

          <form onSubmit={(e) => handleSendMessage(e)} className="flex gap-2">
            <input
              type="text"
              placeholder="Ask about SMC structure, OTE, or risk..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isSending}
              className="flex-1 bg-[#F8FAF9] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer flex items-center justify-center min-w-[38px] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <div className="flex justify-between items-center text-[11px] text-slate-500">
            <span>Context synced</span>
            <button
              onClick={handleClearHistory}
              className="hover:text-rose-600 transition cursor-pointer"
            >
              Reset Chat
            </button>
          </div>
        </div>
      )}

      {imageModalUrl && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setImageModalUrl(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[85vh] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-6 flex flex-col items-center">
            <button
              onClick={() => setImageModalUrl(null)}
              className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition cursor-pointer z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="w-full flex-1 overflow-auto flex items-center justify-center">
              <img
                src={imageModalUrl}
                alt="SMC Schematic Diagram"
                className="max-w-full max-h-[70vh] object-contain rounded-xl border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
