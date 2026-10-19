import React from "react";
import { MultiFactorQuantAnalysis, formatPriceBySymbol } from "../lib/quantEngine";
import { SyntheticSymbol } from "../data/symbols";
import {
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Target,
  Layers,
  Crosshair,
  BarChart3,
  AlertTriangle,
} from "lucide-react";

interface QuantConfluencePanelProps {
  quant: MultiFactorQuantAnalysis;
  symbol: SyntheticSymbol;
}

export const QuantConfluencePanel: React.FC<QuantConfluencePanelProps> = ({ quant, symbol }) => {
  const isBullish = quant.directionalBias === "BULLISH";
  const isBearish = quant.directionalBias === "BEARISH";

  const modulesArray = [
    quant.modules.module1_smc,
    quant.modules.module2_fibonacci,
    quant.modules.module3_priceAction,
    quant.modules.module4_assetQuant,
    quant.modules.module5_riskExecution,
  ];

  return (
    <div className="space-y-5">
      {/* MODULE 5: STRUCTURED DYNAMIC RISK & EXECUTION TRADE CARD */}
      <div className="bg-[#111622] border border-slate-800 rounded-xl p-5 space-y-5">
        {/* Top Header: Bias, Confluence Score %, High-Probability Gate */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>{quant.symbol}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-cyan-400">{quant.timeframe}</span>
              <span aria-hidden="true">·</span>
              <span>
                {quant.isHighProbability
                  ? "High Probability Alert Triggered (≥3/5 Modules)"
                  : "Awaiting Liquidity Sweep Confirmation"}
              </span>
            </div>
            <h2 className="text-lg font-bold font-display text-white">
              {quant.confluenceFormulaSummary}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Directional Bias */}
            <div
              className={`px-3.5 py-2 rounded-lg border text-right ${
                isBullish
                  ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400"
                  : isBearish
                  ? "bg-rose-950/30 border-rose-500/40 text-rose-400"
                  : "bg-amber-950/30 border-amber-500/40 text-amber-400"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider block text-slate-400">
                Directional Bias
              </span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-xs mt-0.5">
                {isBullish ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : isBearish ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                <span>{quant.directionalBias}</span>
              </div>
            </div>

            {/* Multi-Factor Confluence Score */}
            <div className="px-4 py-2 rounded-lg bg-[#0B0E14] border border-cyan-500/40 text-center">
              <span className="text-[10px] uppercase tracking-wider block text-slate-400">
                Confluence
              </span>
              <span className="text-base font-mono font-bold text-cyan-400">
                {quant.confluenceScorePct}% ({quant.alignedModulesCount}/5)
              </span>
            </div>
          </div>
        </div>

        {/* Execution Levels Grid: Entry Zone (0.705 OTE), Stop Loss (ATR Buffered), Risk-to-Reward */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
              Optimal Entry (0.705 OTE)
            </span>
            <span className="text-base font-mono font-bold text-cyan-400 mt-1 block">
              {formatPriceBySymbol(quant.executionCard.optimalEntry705, symbol)}
            </span>
            <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
              OTE Zone: {formatPriceBySymbol(quant.executionCard.entryZoneLow, symbol)} –{" "}
              {formatPriceBySymbol(quant.executionCard.entryZoneHigh, symbol)}
            </span>
          </div>

          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
              Invalidation Stop Loss
            </span>
            <span className="text-base font-mono font-bold text-rose-400 mt-1 block">
              {formatPriceBySymbol(quant.executionCard.invalidationStopLoss, symbol)}
            </span>
            <span className="text-[11px] font-mono text-slate-400 mt-0.5 block truncate">
              Buffer: {quant.executionCard.atrBufferApplied}
            </span>
          </div>

          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
              Dealing Range Filter
            </span>
            <span className="text-sm font-mono font-bold text-emerald-400 mt-1 block">
              {quant.fibonacciMatrix.dealingZone}
            </span>
            <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
              0.50 EQ: {formatPriceBySymbol(quant.fibonacciMatrix.equilibrium50, symbol)}
            </span>
          </div>

          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
              Risk-to-Reward Ratio
            </span>
            <span className="text-base font-mono font-bold text-amber-400 mt-1 block">
              {quant.executionCard.riskRewardRatio}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 mt-0.5 block">
              Min 1:2.5 Institutional Gate ✓
            </span>
          </div>
        </div>

        {/* Tiered Fibonacci Extension Take-Profit Targets (TP1 1.272, TP2 1.618, TP3 2.0) */}
        <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-emerald-400" />
              <span>Projected Fibonacci Extension Take-Profit Targets</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Order Type: {quant.executionCard.orderType}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#111622] border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block">
                  TP1 (1.272 Fib Ext · 50% Scale)
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
                  {formatPriceBySymbol(quant.executionCard.tp1_1272, symbol)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Move SL → BE</span>
            </div>

            <div className="p-3 rounded-lg bg-[#111622] border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block">
                  TP2 (1.618 Golden Ext · 30% Scale)
                </span>
                <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
                  {formatPriceBySymbol(quant.executionCard.tp2_1618, symbol)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400">{quant.executionCard.riskRewardRatio}</span>
            </div>

            <div className="p-3 rounded-lg bg-[#111622] border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-slate-400 block">
                  TP3 (2.000 Full Leg Ext · 20% Runner)
                </span>
                <span className="text-sm font-mono font-bold text-emerald-300 mt-0.5 block">
                  {formatPriceBySymbol(quant.executionCard.tp3_2000, symbol)}
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-400">Runner Target</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5-MODULE QUANTITATIVE CONFLUENCE BREAKDOWN */}
      <div className="bg-[#111622] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold font-display text-white">
              Multi-Factor Quantitative Confluence Breakdown (5-Module Engine)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Threshold: ≥3/5 Modules Aligned for High Probability
          </span>
        </div>

        <div className="space-y-3">
          {modulesArray.map((mod) => (
            <div
              key={mod.id}
              className="bg-[#0B0E14] border border-slate-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      mod.aligned ? "text-emerald-400" : "text-slate-500"
                    }`}
                  />
                  <span className="text-xs font-bold font-display text-white">{mod.title}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-400">{mod.headline}</span>
                  <span className="text-cyan-400 font-bold shrink-0">
                    {mod.earnedScore}/{mod.weight} pts
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {mod.metrics.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded bg-[#111622] border border-slate-800/80 text-xs"
                  >
                    <span className="text-[10px] text-slate-400 block">{m.label}</span>
                    <span
                      className={`font-mono font-semibold mt-0.5 block truncate ${
                        m.highlight === "emerald"
                          ? "text-emerald-400"
                          : m.highlight === "cyan"
                          ? "text-cyan-400"
                          : m.highlight === "amber"
                          ? "text-amber-400"
                          : m.highlight === "rose"
                          ? "text-rose-400"
                          : "text-slate-200"
                      }`}
                      title={m.value}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{mod.details}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
