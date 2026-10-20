import React, { useState } from "react";
import { Trade } from "../lib/db";
import { SYNTHETIC_SYMBOLS } from "../data/symbols";
import { Save, AlertCircle, RefreshCw, Calculator, DollarSign } from "lucide-react";

interface TradeSettlementFormProps {
  trade: Trade;
  onSave: (status: "PENDING" | "WON" | "LOST" | "BREAKEAVEN", exitPrice: number, pnl: number) => Promise<void>;
  onClose?: () => void;
}

export default function TradeSettlementForm({ trade, onSave }: TradeSettlementFormProps) {
  const [status, setStatus] = useState<"PENDING" | "WON" | "LOST" | "BREAKEAVEN">(trade.status);
  const [entryPrice, setEntryPrice] = useState<number>(trade.entry_price || 0.0);

  const symbolDetails = SYNTHETIC_SYMBOLS.find((s) => s.ticker === trade.symbol) || {
    minLotSize: 0.1,
    lotStepValue: 1.0,
    pointMultiplier: 1.0,
  };

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
    return (
      trade.pnl !== undefined &&
      trade.pnl !== null &&
      (trade.exit_price === undefined || trade.exit_price === null)
    );
  });

  const [manualPnl, setManualPnl] = useState<number>(trade.pnl || 0.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuy =
    trade.bias === "BULLISH" ||
    trade.bias?.toUpperCase() === "BUY" ||
    trade.bias?.toUpperCase() === "LONG" ||
    trade.bias?.toUpperCase() === "CALL";
  const directionFactor = isBuy ? 1 : -1;
  const lotStepValue = symbolDetails.lotStepValue || 1.0;

  const calculatedPnl = isManualPnl
    ? manualPnl
    : status === "BREAKEAVEN" || status === "PENDING"
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
      setError(err?.message || "Could not save trade outcomes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-4" id={`settlement-panel-${trade.id}`}>
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <h4 className="text-xs font-bold text-slate-900 font-display flex items-center gap-1.5">
          <Calculator className="h-4 w-4 text-emerald-600" />
          Outcome Settlement &amp; Realized P&amp;L
        </h4>
        <span className="text-xs font-mono text-slate-500">
          {trade.symbol} · Mult: {lotStepValue}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs text-slate-600 font-medium mb-1.5">Outcome Status</label>
          <div className="grid grid-cols-4 gap-2">
            {(["PENDING", "WON", "LOST", "BREAKEAVEN"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusChange(s)}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors border cursor-pointer ${
                  status === s
                    ? s === "WON"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : s === "LOST"
                      ? "bg-rose-600 border-rose-600 text-white"
                      : s === "BREAKEAVEN"
                      ? "bg-slate-800 border-slate-800 text-white"
                      : "bg-amber-600 border-amber-600 text-white"
                    : "bg-[#F8FAF9] border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                {s === "BREAKEAVEN" ? "B/E" : s}
              </button>
            ))}
          </div>
        </div>

        {status !== "PENDING" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Entry Price</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full text-xs p-2.5 bg-[#F8FAF9] border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600 font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Exit Price</label>
              <input
                type="number"
                step="any"
                disabled={status === "BREAKEAVEN"}
                value={status === "BREAKEAVEN" ? entryPrice : exitPrice}
                onChange={(e) => setExitPrice(Number(e.target.value))}
                className="w-full text-xs p-2.5 bg-[#F8FAF9] border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600 disabled:opacity-50 font-mono tabular-nums"
              />
            </div>
          </div>
        )}

        {status !== "PENDING" && status !== "BREAKEAVEN" && (
          <div className="bg-[#F8FAF9] p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isManualPnl}
                  onChange={(e) => setIsManualPnl(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <span>Manual P&amp;L Override ($)</span>
              </label>

              {!isManualPnl && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">Volume (Lots):</span>
                  <input
                    type="number"
                    step="any"
                    min={symbolDetails.minLotSize || 0.01}
                    value={lotSize}
                    onChange={(e) => setLotSize(Number(e.target.value))}
                    className="w-20 text-xs p-1.5 bg-white border border-slate-300 rounded text-center text-slate-900 focus:outline-none focus:border-emerald-600 font-mono font-bold tabular-nums"
                  />
                </div>
              )}
            </div>

            {isManualPnl && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Realized P&amp;L ($ USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="number"
                    step="any"
                    placeholder="Enter manual amount"
                    value={manualPnl}
                    onChange={(e) => setManualPnl(Number(e.target.value))}
                    className="w-full text-xs pl-8 p-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600 font-mono font-bold tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {status !== "PENDING" && (
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              calculatedPnl > 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : calculatedPnl < 0
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-[#F8FAF9] border-slate-200 text-slate-700"
            }`}
          >
            <span className="text-xs font-semibold">Projected Realized P&amp;L</span>
            <span className="text-sm font-bold font-mono tabular-nums">
              {calculatedPnl > 0 ? "+" : ""}
              {calculatedPnl.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USD
            </span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Updating Ledger...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Commit Trade Settlement</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
