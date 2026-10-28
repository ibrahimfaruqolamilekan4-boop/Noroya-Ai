import React, { useState, useEffect } from "react";
import { SYNTHETIC_SYMBOLS, SyntheticSymbol } from "../data/symbols";
import { ShieldAlert, HelpCircle } from "lucide-react";

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

  useEffect(() => {
    if (selectedSymbolTicker) {
      const match = SYNTHETIC_SYMBOLS.find((s) => s.ticker === selectedSymbolTicker);
      if (match) {
        setSelectedSymbol(match);
        setCustomSymbol(false);
      }
    }
  }, [selectedSymbolTicker]);

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

  const dollarRisk = balance * (riskPercent / 100);
  const lotSizeMultiplier = customSymbol ? customPointValue : selectedSymbol.lotStepValue;
  const rawLotSize = dollarRisk / (stopLossPoints * lotSizeMultiplier);
  const minRequiredLot = customSymbol ? customMinLot : selectedSymbol.minLotSize;
  const finalLotSize = Math.max(minRequiredLot, rawLotSize);
  const isLotSizeBelowMinimum = rawLotSize < minRequiredLot;

  return (
    <div className="bg-[#F1F4F8] border border-slate-300/80 rounded-xl p-6" id="risk-calculator">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6 border-b border-slate-300 pb-4">
        <div>
          <div className="text-xs font-mono text-emerald-700">
            Position Sizing &amp; Capital Preservation
          </div>
          <h2 className="text-xl font-bold font-display text-slate-900">
            Mechanical Risk Sizer
          </h2>
        </div>
        <div className="text-xs text-slate-600 font-mono">
          1%–2% Institutional Risk Protocol · Multi-Asset Lot Engine
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Input Fields Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Trading Capital ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                $
              </span>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(Math.max(1, Number(e.target.value)))}
                className="w-full pl-8 pr-4 py-2.5 bg-[#E8ECF2] border border-slate-300 rounded-lg focus:border-emerald-600 focus:bg-white focus:outline-none transition text-sm font-mono text-slate-900 tabular-nums"
                placeholder="Account Balance"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Risk Allocation (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="20"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Math.max(0.1, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 bg-[#E8ECF2] border border-slate-300 rounded-lg focus:border-emerald-600 focus:bg-white focus:outline-none transition text-sm font-mono text-slate-900 tabular-nums"
                placeholder="Risk %"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Stop Loss Distance (Points)
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={stopLossPoints}
                onChange={(e) => setStopLossPoints(Math.max(0.0001, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 bg-[#E8ECF2] border border-slate-300 rounded-lg focus:border-emerald-600 focus:bg-white focus:outline-none transition text-sm font-mono text-slate-900 tabular-nums"
                placeholder="SL Price Units"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Target Instrument
              </label>
              <button
                type="button"
                onClick={() => setCustomSymbol(!customSymbol)}
                className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                {customSymbol ? "Select Instrument Presets" : "Use Custom Contract Parameters"}
              </button>
            </div>

            {!customSymbol ? (
              <select
                value={selectedSymbol.ticker}
                onChange={(e) => {
                  const match = SYNTHETIC_SYMBOLS.find((s) => s.ticker === e.target.value);
                  if (match) setSelectedSymbol(match);
                }}
                className="w-full px-3.5 py-2.5 bg-[#E8ECF2] border border-slate-300 rounded-lg focus:border-emerald-600 focus:bg-white focus:outline-none transition text-sm text-slate-900 font-medium"
              >
                {SYNTHETIC_SYMBOLS.map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.name} ({s.ticker}) — Min Lot: {s.minLotSize}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3.5 bg-[#E8ECF2] border border-slate-300 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Min Lot Size</label>
                    <input
                      type="number"
                      step="any"
                      value={customMinLot}
                      onChange={(e) => setCustomMinLot(Math.max(0.0001, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:border-emerald-600 focus:outline-none text-xs font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Point Multiplier</label>
                    <input
                      type="number"
                      step="any"
                      value={customPointValue}
                      onChange={(e) => setCustomPointValue(Math.max(0.0001, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:border-emerald-600 focus:outline-none text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Output Calculations Column */}
        <div className="bg-[#E8ECF2] border border-slate-300 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-slate-300 pb-3">
              <div>
                <p className="text-slate-600 text-xs font-medium">Capital at Risk</p>
                <p className="text-xs text-slate-500 mt-0.5">{riskPercent}% of ${balance.toLocaleString()}</p>
              </div>
              <p className="text-2xl font-bold font-mono text-rose-600 tabular-nums">
                ${dollarRisk.toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-slate-600 text-xs font-medium">Recommended Position Size</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-extrabold font-mono text-emerald-700 tabular-nums">
                  {finalLotSize.toFixed(
                    selectedSymbol.minLotSize < 0.01
                      ? 4
                      : selectedSymbol.minLotSize < 0.1
                      ? 3
                      : 2
                  )}
                </p>
                <span className="text-xs font-mono text-slate-600 font-semibold">LOTS</span>
              </div>
            </div>

            {isLotSizeBelowMinimum && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Minimum Lot Floor Reached</span>
                  <span className="text-amber-800/90 text-[11px] leading-relaxed">
                    Exact mathematical lot ({rawLotSize.toFixed(4)}) is below {selectedSymbol.name}&apos;s broker minimum ({minRequiredLot}). Executing at minimum lot risks{" "}
                    <strong className="font-mono">
                      ${(minRequiredLot * stopLossPoints * lotSizeMultiplier).toFixed(2)}
                    </strong>
                    .
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-300 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
              Min Lot: {minRequiredLot}
            </span>
            <span>Multiplier: {lotSizeMultiplier}x</span>
          </div>
        </div>
      </div>
    </div>
  );
}
