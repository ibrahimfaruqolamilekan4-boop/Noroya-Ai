import React, { useState, useEffect } from "react";
import { SYNTHETIC_SYMBOLS, SyntheticSymbol } from "../data/symbols";
import { ShieldAlert, DollarSign, HelpCircle, RefreshCcw } from "lucide-react";

interface RiskCalculatorProps {
  initialBalance?: number;
  initialRiskPercent?: number;
  onBalanceChange?: (val: number) => void;
  selectedSymbolTicker?: string;
  initialStopLossPoints?: number;
}

export default function RiskCalculator({
  initialBalance = 1000,
  initialRiskPercent = 1.0,
  onBalanceChange,
  selectedSymbolTicker,
  initialStopLossPoints,
}: RiskCalculatorProps) {
  const [balance, setBalance] = useState<number>(initialBalance);
  const [riskPercent, setRiskPercent] = useState<number>(initialRiskPercent);
  const [selectedSymbol, setSelectedSymbol] = useState<SyntheticSymbol>(
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === selectedSymbolTicker) || SYNTHETIC_SYMBOLS[0]
  );
  const [stopLossPoints, setStopLossPoints] = useState<number>(initialStopLossPoints || 100);
  const [customSymbol, setCustomSymbol] = useState(false);
  const [customMinLot, setCustomMinLot] = useState(0.01);
  const [customPointValue, setCustomPointValue] = useState(1.0);

  // Sync selected symbol from outer dashboard changes (e.g. from uploaded chart predictions)
  useEffect(() => {
    if (selectedSymbolTicker) {
      const match = SYNTHETIC_SYMBOLS.find((s) => s.ticker === selectedSymbolTicker);
      if (match) {
        setSelectedSymbol(match);
        setCustomSymbol(false);
      }
    }
  }, [selectedSymbolTicker]);

  // Sync stop loss points from prediction
  useEffect(() => {
    if (initialStopLossPoints) {
      setStopLossPoints(initialStopLossPoints);
    }
  }, [initialStopLossPoints]);

  useEffect(() => {
    if (onBalanceChange) {
      onBalanceChange(balance);
    }
  }, [balance, onBalanceChange]);

  // Risk Calculations
  const dollarRisk = (balance * (riskPercent / 100));
  
  const lotSizeMultiplier = customSymbol ? customPointValue : selectedSymbol.lotStepValue;
  const rawLotSize = dollarRisk / (stopLossPoints * lotSizeMultiplier);
  
  const minRequiredLot = customSymbol ? customMinLot : selectedSymbol.minLotSize;
  const finalLotSize = Math.max(minRequiredLot, rawLotSize);
  const isLotSizeBelowMinimum = rawLotSize < minRequiredLot;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 glow-cyan" id="risk-calculator">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold font-display text-cyan-400">Mechanical Risk Sizer</h2>
          <p className="text-xs text-slate-600">Position size guidelines respecting the 1-2% risk discipline</p>
        </div>
        <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Deriv Lot Protocols
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Input Fields Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Trading Capital ($)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Math.max(1, Number(e.target.value)))}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:border-cyan-400 focus:outline-none transition text-sm font-mono text-slate-900"
                placeholder="Account Balance"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Risk Percent (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="20"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:border-cyan-400 focus:outline-none transition text-sm font-mono text-slate-900"
                placeholder="Risk %"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Stop Loss (Points)
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={stopLossPoints}
                onChange={(e) => setStopLossPoints(Math.max(0.0001, Number(e.target.value)))}
                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:border-cyan-400 focus:outline-none transition text-sm font-mono text-slate-900"
                placeholder="SL Price Units"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Targeted Synthetic Index
              </label>
              <button
                type="button"
                onClick={() => setCustomSymbol(!customSymbol)}
                className="text-xs text-sky-400 hover:underline"
              >
                {customSymbol ? "Select Presets" : "Use Custom Parameters"}
              </button>
            </div>

            {!customSymbol ? (
              <select
                value={selectedSymbol.ticker}
                onChange={(e) => {
                  const match = SYNTHETIC_SYMBOLS.find((s) => s.ticker === e.target.value);
                  if (match) setSelectedSymbol(match);
                }}
                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl focus:border-cyan-400 focus:outline-none transition text-sm text-slate-900"
              >
                {SYNTHETIC_SYMBOLS.map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.name} ({s.ticker}) — Min: {s.minLotSize}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-600 uppercase tracking-wide mb-1">Min Lot Size</label>
                    <input
                      type="number"
                      step="any"
                      value={customMinLot}
                      onChange={(e) => setCustomMinLot(Math.max(0.0001, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded focus:border-cyan-400 focus:outline-none text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 uppercase tracking-wide mb-1">Point Value multiplier</label>
                    <input
                      type="number"
                      step="any"
                      value={customPointValue}
                      onChange={(e) => setCustomPointValue(Math.max(0.0001, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded focus:border-cyan-400 focus:outline-none text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Output Calculations Column */}
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Absolute Dollar Risk</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-2xl font-bold font-mono text-rose-400">${dollarRisk.toFixed(2)}</p>
                <p className="text-xs text-slate-500">({riskPercent}% of balance)</p>
              </div>
            </div>

            <div>
              <p className="text-slate-600 text-xs font-semibold uppercase tracking-wider">Calculated Position Size</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <p className="text-4xl font-extrabold font-mono text-emerald-400">
                  {finalLotSize.toFixed(Math.max(2, String(minRequiredLot).split(".")[1]?.length || 2))}
                </p>
                <p className="text-sm font-semibold text-slate-600">Lots</p>
              </div>
            </div>

            {/* Warnings Container */}
            <div className="space-y-2">
              {isLotSizeBelowMinimum && (
                <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">Min Lot Size Constraint</h4>
                    <p className="text-[10px] text-slate-700">
                      Ideal lot ({rawLotSize.toFixed(3)}) is below index minimum ({minRequiredLot}). Trading the actual minimum lot will increase your risked capital to{" "}
                      <span className="font-mono text-amber-200">${(minRequiredLot * stopLossPoints * lotSizeMultiplier).toFixed(2)}</span>.
                    </p>
                  </div>
                </div>
              )}

              {!customSymbol && selectedSymbol.category === "Boom/Crash" && (
                <div className="bg-[#1e1515] border border-red-900/40 p-3 rounded-xl flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-red-400">Boom/Crash Spike Precaution</h4>
                    <p className="text-[10px] text-slate-700">
                      Standard stop losses can be bypassed during market Spikes (Boom index spikes buy side, Crash spikes sell side). Ensure you use a wide stop loss buffer and conservative lot sizes!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3.5 mt-4">
            <span className="text-[11px] text-slate-500 italic block leading-normal">
              Remember: Synthetics run 24/7/365 with unchanging liquidity. Ensure high precision on SL parameters to protect account equity.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
