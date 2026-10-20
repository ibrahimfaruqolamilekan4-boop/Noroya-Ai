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
  TrendingUp,
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
  onSave,
}: QuickNoteModalProps) {
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const initialTrade =
    sortedTrades.find((t) => t.symbol === currentSymbol) || sortedTrades[0];

  const [selectedTradeId, setSelectedTradeId] = useState<string>(initialTrade?.id || "");
  const [notesText, setNotesText] = useState<string>("");
  const [appendSnippet, setAppendSnippet] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState<boolean>(false);

  const activeTrade = sortedTrades.find((t) => t.id === selectedTradeId);

  useEffect(() => {
    if (activeTrade) {
      setNotesText(activeTrade.notes || "");
      setErrorStatus(null);
      setIsSavedSuccessfully(false);
    }
  }, [selectedTradeId, activeTrade]);

  const handleInsertTimestamp = () => {
    const timestamp = `[${new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })}] `;
    setAppendSnippet((prev) => timestamp + prev);
  };

  const handleAppendNotes = () => {
    if (!appendSnippet.trim()) return;
    const divider = notesText.trim() ? "\n" : "";
    setNotesText((prev) => prev + divider + appendSnippet);
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
        setErrorStatus("Failed to update trade notes.");
      }
    } catch (err: any) {
      setErrorStatus(err?.message || "Notes could not be written to the database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      id="quick-note-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-slate-900"
        id="quick-note-modal-content"
      >
        <div className="p-5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Quick Trade Journal Notes
              </h3>
              <p className="text-xs text-slate-500">Append execution context to your trade log</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#F8FAF9] hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Position Log
            </label>
            {sortedTrades.length === 0 ? (
              <div className="p-3 bg-[#F8FAF9] border border-slate-200 rounded-lg text-center text-xs text-slate-600">
                No recorded journal positions available yet. Save a setup from the Analyzer first.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedTradeId}
                  onChange={(e) => setSelectedTradeId(e.target.value)}
                  className="w-full text-xs p-3 pr-8 bg-[#F8FAF9] border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-emerald-600 appearance-none cursor-pointer"
                >
                  {sortedTrades.map((t) => {
                    const parsedDate = new Date(t.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const biasLabel = t.bias === "BULLISH" || t.bias === "LONG" ? "Buy" : "Sell";
                    return (
                      <option key={t.id} value={t.id}>
                        {t.symbol} ({biasLabel} · {t.status}) — {parsedDate}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
            )}
          </div>

          {activeTrade && (
            <>
              <div className="p-3 bg-[#F8FAF9] border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                <div className="flex gap-4">
                  <span>
                    Entry: <strong className="text-slate-900">{activeTrade.entry_price}</strong>
                  </span>
                  <span>
                    SL: <strong className="text-rose-600">{activeTrade.stop_loss}</strong>
                  </span>
                </div>
                <span className="font-semibold text-emerald-700">{activeTrade.status}</span>
              </div>

              <div className="bg-[#F8FAF9] p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    Quick Snippet Appender
                  </span>
                  <button
                    type="button"
                    onClick={handleInsertTimestamp}
                    className="text-xs text-emerald-700 font-semibold hover:underline cursor-pointer"
                  >
                    + Insert Timestamp
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type supplemental execution memo..."
                    value={appendSnippet}
                    onChange={(e) => setAppendSnippet(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAppendNotes();
                      }
                    }}
                    className="flex-1 p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={handleAppendNotes}
                    className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Append</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Position Commentary
                </label>
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Enter trade execution notes..."
                  className="w-full min-h-[130px] p-3 text-xs bg-[#F8FAF9] border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed"
                />
              </div>
            </>
          )}

          {errorStatus && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorStatus}</span>
            </div>
          )}

          {isSavedSuccessfully && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Notes updated in your trade journal.</span>
            </div>
          )}

          {activeTrade && (
            <div className="flex gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="w-2/5 p-2.5 bg-white hover:bg-slate-50 border border-slate-300 font-semibold rounded-lg text-xs text-slate-700 cursor-pointer text-center transition"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-3/5 p-2.5 bg-emerald-600 hover:bg-emerald-700 font-semibold rounded-lg text-xs text-white cursor-pointer transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Notes</span>
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
