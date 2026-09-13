import React, { useState, useEffect } from "react";
import { Trade } from "../lib/db";
import { 
  X, 
  MessageSquare, 
  Save, 
  Clock, 
  AlertCircle, 
  Check, 
  ArrowRight,
  TrendingUp
} from "lucide-react";

interface QuickNoteModalProps {
  trades: Trade[];
  currentSymbol?: string;
  onClose: () => void;
  onSave: (tradeId: string, notes: string) => Promise<boolean>;
}

export default function QuickNoteModal({ 
  trades, 
  currentSymbol, 
  onClose, 
  onSave 
}: QuickNoteModalProps) {
  // Sort trades by created_at descending (latest first)
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Default to the first trade that matches currentSymbol, otherwise the absolute latest trade
  const initialTrade = sortedTrades.find(t => t.symbol === currentSymbol) || sortedTrades[0];
  
  const [selectedTradeId, setSelectedTradeId] = useState<string>(initialTrade?.id || "");
  const [notesText, setNotesText] = useState<string>("");
  const [appendSnippet, setAppendSnippet] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState<boolean>(false);

  // Find the currently active trade object
  const activeTrade = sortedTrades.find(t => t.id === selectedTradeId);

  // Keep track of activeTrade changes to update text area
  useEffect(() => {
    if (activeTrade) {
      setNotesText(activeTrade.notes || "");
      setErrorStatus(null);
      setIsSavedSuccessfully(false);
    }
  }, [selectedTradeId, activeTrade]);

  // Insert a quick timestamp helper to make appending notes extremely fast & clean
  const handleInsertTimestamp = () => {
    const timestamp = `[${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}] `;
    setAppendSnippet(prev => timestamp + prev);
  };

  const handleAppendNotes = () => {
    if (!appendSnippet.trim()) return;
    const divider = notesText.trim() ? "\n" : "";
    setNotesText(prev => prev + divider + appendSnippet);
    setAppendSnippet("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTradeId) return;

    setIsSubmitting(true);
    setErrorStatus(null);
    setIsSavedSuccessfully(false);

    try {
      const finalNotes = notesText.trim();
      const success = await onSave(selectedTradeId, finalNotes);
      if (success) {
        setIsSavedSuccessfully(true);
        setTimeout(() => {
          setIsSavedSuccessfully(false);
        }, 3000);
      } else {
        setErrorStatus("Failed to update trade notes. Please verify connection credentials.");
      }
    } catch (err: any) {
      setErrorStatus(err?.message || "Notes could not be written to the database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-50/80 backdrop-blur-sm transition-opacity"
      id="quick-note-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-lg bg-[#0f172a] border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150"
        id="quick-note-modal-content"
      >
        {/* Header bar with accent glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-500"></div>

        <div className="p-5 flex items-center justify-between border-b border-slate-850">
          <div className="flex items-center gap-2">
            <div className="p-1 px-1.5 rounded-lg bg-indigo-950/50 border border-indigo-900/30">
              <MessageSquare className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display uppercase tracking-wider">
                Quick Analyzer Notes
              </h3>
              <p className="text-[10px] text-slate-600 font-mono">APPEND TRADE CONTEXT INSTANTLY</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-850 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          
          {/* Trade Selector */}
          <div>
            <label className="block text-[10px] uppercase font-mono text-slate-600 mb-1.5 font-bold tracking-wider">
              Select Position context
            </label>
            {sortedTrades.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-850 rounded-xl text-center text-xs text-slate-500 leading-normal">
                No recorded journal positions available. Log a position at the bottom of the analysis first!
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTradeId}
                  onChange={(e) => setSelectedTradeId(e.target.value)}
                  className="w-full text-xs p-3 pr-8 bg-slate-50 border border-slate-850 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                >
                  {sortedTrades.map((t) => {
                    const parsedDate = new Date(t.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    });
                    const biasLabel = t.bias === "BULLISH" || t.bias === "LONG" ? "▲ Buy" : "▼ Sell";
                    const statusDot = t.status === "WON" ? "🟢" : t.status === "LOST" ? "🔴" : t.status === "BREAKEAVEN" ? "⚪" : "🟡";
                    return (
                      <option key={t.id} value={t.id} className="bg-slate-50 text-slate-800">
                        {statusDot} {t.symbol} ({biasLabel}) • {parsedDate}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-600">
                  <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                </div>
              </div>
            )}
          </div>

          {activeTrade && (
            <>
              {/* Context Summary details */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px] text-slate-600">
                <div className="flex gap-4">
                  <span>Entry: <code className="font-mono text-slate-800 font-semibold">{activeTrade.entry_price}</code></span>
                  {activeTrade.status !== "PENDING" && (
                    <span>Exit: <code className="font-mono text-slate-250 font-semibold">{activeTrade.exit_price || "N/A"}</code></span>
                  )}
                  <span>SL: <code className="font-mono text-rose-400 font-semibold">{activeTrade.stop_loss}</code></span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border uppercase ${
                  activeTrade.status === "WON"
                    ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-400"
                    : activeTrade.status === "LOST"
                      ? "bg-rose-950/30 border-rose-900/40 text-rose-400"
                      : activeTrade.status === "BREAKEAVEN"
                        ? "bg-slate-100 border-slate-200 text-slate-700"
                        : "bg-amber-950/30 border-amber-900/40 text-rose-400"
                }`}>
                  {activeTrade.status}
                </span>
              </div>

              {/* Timestamp Appender Area */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-500 uppercase font-mono font-bold tracking-widest flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    Quick Note Appender
                  </span>
                  <button
                    type="button"
                    onClick={handleInsertTimestamp}
                    className="text-[9px] text-cyan-400 font-mono hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Insert Timestamp
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type supplemental memo here ..."
                    value={appendSnippet}
                    onChange={(e) => setAppendSnippet(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAppendNotes();
                      }
                    }}
                    className="flex-grow p-2 text-xs bg-[#0f172a] border border-slate-850 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={handleAppendNotes}
                    className="px-3 bg-slate-100 hover:bg-slate-200 text-indigo-400 border border-slate-850 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Append</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Master Editable Notes */}
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-600 mb-1 font-bold tracking-wider">
                  Full Position Findings & Journal Notes
                </label>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Master trade commentary..."
                  className="w-full min-h-[140px] p-3 text-xs bg-slate-50 border border-slate-850 rounded-xl text-slate-800 focus:outline-none focus:border-cyan-500 font-sans leading-relaxed"
                />
              </div>
            </>
          )}

          {errorStatus && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-lg text-xs leading-relaxed flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorStatus}</span>
            </div>
          )}

          {isSavedSuccessfully && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-400 animate-pulse" />
              <span>Context updated securely in the live database journal!</span>
            </div>
          )}

          {/* Action Footer */}
          {activeTrade && (
            <div className="flex gap-3 pt-2 border-t border-slate-850">
              <button
                type="button"
                onClick={onClose}
                className="w-2/5 p-2.5 bg-slate-100 hover:bg-slate-850 border border-slate-200 font-bold rounded-xl text-xs text-slate-350 cursor-pointer text-center transition"
              >
                Clear / Exit
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-3/5 p-2.5 bg-indigo-650 hover:bg-indigo-600 border border-indigo-500 font-bold rounded-xl text-xs text-slate-900 cursor-pointer transition flex items-center justify-center gap-2 disabled:opacity-45"
              >
                {isSubmitting ? (
                  <span>Saving to ledger...</span>
                ) : (
                  <>
                    <Save className="h-4 w-4 text-cyan-400" />
                    <span>Commit Notes Update</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
