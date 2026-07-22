import React, { useState, useEffect } from "react";
import { Trade } from "../lib/db";
import { SYNTHETIC_SYMBOLS } from "../data/symbols";
import { Save, AlertCircle, RefreshCw, Calculator, DollarSign } from "lucide-react";

interface TradeSettlementFormProps {
  trade: Trade;
  onSave: (status: "PENDING" | "WON" | "LOST" | "BREAKEAVEN", exitPrice: number, pnl: number) => Promise<void>;
  onClose?: () => void;
}

export default function TradeSettlementForm({ trade, onSave, onClose }: TradeSettlementFormProps) {
  const [status, setStatus] = useState<"PENDING" | "WON" | "LOST" | "BREAKEAVEN">(trade.status);
  const [entryPrice, setEntryPrice] = useState<number>(trade.entry_price || 0.0);
  
  // Find matching trade symbol details
  const symbolDetails = SYNTHETIC_SYMBOLS.find(s => s.ticker === trade.symbol) || {
    minLotSize: 0.1,
    lotStepValue: 1.0,
    pointMultiplier: 1.0
  };

  // Prepopulate exit price based on take_profit or stop_loss if status changes
  const getDefaultExitPrice = (newStatus: typeof status) => {
    if (trade.exit_price !== undefined && trade.exit_price !== null) {
      return trade.exit_price;
    }
    if (newStatus === "WON" && trade.take_profit) {
      return trade.take_profit;
    }
    if (newStatus === "LOST" && trade.stop_loss) {
      return trade.stop_loss;
    }
    return trade.entry_price || 0.0;
  };

  const [exitPrice, setExitPrice] = useState<number>(() => {
    return trade.exit_price !== undefined && trade.exit_price !== null 
      ? trade.exit_price 
      : getDefaultExitPrice(trade.status);
  });

  const [lotSize, setLotSize] = useState<number>(() => {
    return symbolDetails.minLotSize || 0.1;
  });

  const [isManualPnl, setIsManualPnl] = useState<boolean>(() => {
    // If the trade already has a PNL saved but no exit_price (or custom override was used), default to manual
    return trade.pnl !== undefined && trade.pnl !== null && (trade.exit_price === undefined || trade.exit_price === null);
  });

  const [manualPnl, setManualPnl] = useState<number>(trade.pnl || 0.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Direction modifier
  const isBuy = trade.bias === "BULLISH" || trade.bias?.toUpperCase() === "BUY" || trade.bias?.toUpperCase() === "LONG" || trade.bias?.toUpperCase() === "CALL";
  const directionFactor = isBuy ? 1 : -1;
  const lotStepValue = symbolDetails.lotStepValue || 1.0;

  // Real-time calculated P&L
  const calculatedPnl = isManualPnl 
    ? manualPnl 
    : status === "BREAKEAVEN" 
      ? 0.0 
      : status === "PENDING"
        ? 0.0
        : (exitPrice - entryPrice) * lotSize * directionFactor * lotStepValue;

  const handleStatusChange = (newStatus: "PENDING" | "WON" | "LOST" | "BREAKEAVEN") => {
    setStatus(newStatus);
    setExitPrice(getDefaultExitPrice(newStatus));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const finalExitPrice = status === "PENDING" ? 0.0 : exitPrice;
      const finalPnl = status === "PENDING" ? 0.0 : calculatedPnl;
      
      await onSave(status, finalExitPrice, finalPnl);
    } catch (err: any) {
      console.error("Failed to settle trade details", err);
      setError(err?.message || "Could not save trade outcomes. Check internet or Firebase rules.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl space-y-4" id={`settlement-panel-${trade.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-white uppercase tracking-widest font-display flex items-center gap-1.5">
          <Calculator className="h-4 w-4 text-cyan-400" />
          Outcome Settlement & P&L
        </h4>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          {trade.symbol} • Step Val: {lotStepValue}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        
        {/* Status Outcome selector */}
        <div>
          <label className="block text-[9px] text-slate-400 uppercase font-mono mb-1.5">Outcome Status</label>
          <div className="grid grid-cols-4 gap-2">
            {(["PENDING", "WON", "LOST", "BREAKEAVEN"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusChange(s)}
                className={`py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all border cursor-pointer ${
                  status === s
                    ? s === "WON"
                      ? "bg-emerald-950/40 border-emerald-500 text-emerald-400 font-extrabold shadow-sm shadow-emerald-500/10"
                      : s === "LOST"
                        ? "bg-rose-950/40 border-rose-500 text-rose-400 font-extrabold shadow-sm shadow-rose-500/10"
                        : s === "BREAKEAVEN"
                          ? "bg-slate-900 border-slate-600 text-slate-300 font-extrabold"
                          : "bg-amber-950/40 border-amber-500 text-amber-400 font-extrabold shadow-sm shadow-amber-500/10"
                    : "bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300 hover:border-slate-800"
                }`}
              >
                {s === "BREAKEAVEN" ? "B / E" : s}
              </button>
            ))}
          </div>
        </div>

        {status !== "PENDING" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Entry Price & Exit Price */}
            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-mono mb-1">Entry Price Point</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full text-xs p-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-mono mb-1">Exit Price Point</label>
              <input
                type="number"
                step="any"
                disabled={status === "BREAKEAVEN"}
                value={status === "BREAKEAVEN" ? entryPrice : exitPrice}
                onChange={(e) => setExitPrice(Number(e.target.value))}
                className="w-full text-xs p-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-mono"
              />
            </div>
          </div>
        )}

        {status !== "PENDING" && status !== "BREAKEAVEN" && (
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-850/60 space-y-3">
            
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isManualPnl}
                  onChange={(e) => setIsManualPnl(e.target.checked)}
                  className="rounded border-slate-800 text-cyan-500 focus:ring-0 bg-slate-950 cursor-pointer"
                />
                <span>Manual P&L Override ($)</span>
              </label>

              {!isManualPnl && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-400 font-mono uppercase">Execution Volume (Lots):</span>
                  <input
                    type="number"
                    step="any"
                    min={symbolDetails.minLotSize || 0.01}
                    value={lotSize}
                    onChange={(e) => setLotSize(Number(e.target.value))}
                    className="w-20 text-[11px] p-1 bg-slate-950 border border-slate-800 rounded text-center text-slate-200 focus:outline-none focus:border-cyan-500 font-mono font-bold"
                  />
                </div>
              )}
            </div>

            {isManualPnl ? (
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-mono mb-1">Actual Realized P&L ($)</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="number"
                    step="any"
                    placeholder="Enter manual amount"
                    value={manualPnl}
                    onChange={(e) => setManualPnl(Number(e.target.value))}
                    className="w-full text-xs pl-8 p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500 font-mono font-extrabold text-indigo-400"
                  />
                </div>
              </div>
            ) : (
              <div className="p-2 border-t border-slate-900/80 flex flex-col justify-between items-start md:flex-row md:items-center text-[10px] space-y-1.5 md:space-y-0">
                <div className="text-slate-400 leading-normal">
                  <span className="font-semibold text-slate-300">Math Basis:</span>{" "}
                  <code className="font-mono text-[9px] bg-slate-950 px-1 py-0.5 rounded text-indigo-300">
                    ({exitPrice.toFixed(2)} - {entryPrice.toFixed(2)}) &times; {lotSize} &times; {directionFactor} (direction) &times; {lotStepValue} (multi)
                  </code>
                </div>
              </div>
            )}
            
          </div>
        )}

        {/* Live Display of Projected Profit / Loss amount */}
        {status !== "PENDING" && (
          <div className={`p-3 rounded-lg border flex items-center justify-between ${
            calculatedPnl > 0 
              ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" 
              : calculatedPnl < 0 
                ? "bg-rose-950/20 border-rose-900/30 text-rose-400" 
                : "bg-slate-950 border-slate-850 text-slate-400"
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider">Projected Settle P&L Amount</span>
            <span className="text-sm font-black font-mono">
              {calculatedPnl > 0 ? "+" : ""}{calculatedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/30 border border-rose-900/40 rounded-lg text-xs leading-relaxed text-rose-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-1 border-t border-slate-850/40">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-gradient-to-r from-indigo-650 to-indigo-600 hover:from-indigo-600 hover:to-indigo-550 border border-indigo-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                Updating Database...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-emerald-400 animate-pulse" />
                Commit Trade Settlement
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
