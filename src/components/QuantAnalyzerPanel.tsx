import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  Clock,
  Layers,
  Flame,
  Target,
  BarChart3,
  Zap,
} from "lucide-react";
import { SyntheticSymbol } from "../data/symbols";
import {
  evaluateMultiFactorConfluence,
  formatPrice,
  getNextFundingCountdown,
  QuantitativeEvaluation,
} from "../lib/quantEngine";

interface QuantAnalyzerPanelProps {
  symbol: SyntheticSymbol;
  timeframe: string;
  aiAnalysisResult?: any;
  onSyncLevelsToWorkspace?: (levels: {
    entry: number;
    stopLoss: number;
    tp1: number;
    tp2: number;
  }) => void;
}

export const QuantAnalyzerPanel: React.FC<QuantAnalyzerPanelProps> = ({
  symbol,
  timeframe,
  aiAnalysisResult,
  onSyncLevelsToWorkspace,
}) => {
  const [fundingCountdown, setFundingCountdown] = useState<string>(getNextFundingCountdown());

  useEffect(() => {
    const timer = setInterval(() => {
      setFundingCountdown(getNextFundingCountdown());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const evaluation: QuantitativeEvaluation = evaluateMultiFactorConfluence(
    symbol,
    timeframe,
    aiAnalysisResult
  );

  const isBullish = evaluation.directionalBias === "BULLISH";
  const isBearish = evaluation.directionalBias === "BEARISH";
  const fm = symbol.futuresMetrics;
  const sp = symbol.syntheticProfile;

  return (
    <div className="space-y-6 text-slate-100">
      {/* ASSET-SPECIFIC QUANTITATIVE TELEMETRY HEADER */}
      {symbol.marketType === "CRYPTO_PERP" && fm && (
        <div className="rounded-2xl bg-[#111622] border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                {fm.exchange} Perpetual Futures Orderflow &amp; Liquidation Telemetry
              </h3>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              <span>{symbol.ticker}</span>
              <span className="mx-2 text-slate-600">·</span>
              <span>Next Funding in {fundingCountdown}</span>
            </div>
          </div>

          {/* 3-Column Futures Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800/90">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Funding Rate ({fm.fundingIntervalHours}h)</span>
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span
                  className={`text-lg font-mono font-bold tabular-nums ${
                    fm.fundingRateNumeric >= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {fm.fundingRate}
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {fundingCountdown}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {fm.fundingRateNumeric < 0
                  ? "Negative funding: crowded shorts vulnerable to BSL squeeze."
                  : "Positive funding: monitor OI flush on SSL sweeps for long entry."}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800/90">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Open Interest &amp; 24h Delta</span>
                <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-lg font-mono font-bold text-white tabular-nums">
                  {fm.openInterestUsd}
                </span>
                <span className="text-xs font-mono text-cyan-400 tabular-nums">
                  {fm.oiDelta24h}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                L/S Ratio: <strong className="text-slate-200 font-mono">{fm.longShortRatio.toFixed(2)}</strong> · CVD:{" "}
                <strong className="text-emerald-400 font-mono">{fm.cvdBias.replace("_", " ")}</strong>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800/90">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>High-Leverage Liquidity Clusters</span>
                <Layers className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <div className="mt-2 space-y-1 text-xs font-mono tabular-nums">
                <div className="flex justify-between text-rose-400">
                  <span>100x / 50x Short Liq (BSL):</span>
                  <span>
                    {formatPrice(fm.liquidationClusters.tier100xShort, symbol)} /{" "}
                    {formatPrice(fm.liquidationClusters.tier50xShort, symbol)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>100x / 50x Long Liq (SSL):</span>
                  <span>
                    {formatPrice(fm.liquidationClusters.tier100xLong, symbol)} /{" "}
                    {formatPrice(fm.liquidationClusters.tier50xLong, symbol)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>25x Institutional Cluster:</span>
                  <span>
                    {formatPrice(fm.liquidationClusters.tier25xLong, symbol)} –{" "}
                    {formatPrice(fm.liquidationClusters.tier25xShort, symbol)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {symbol.marketType === "SYNTHETIC" && (
        <div className="rounded-2xl bg-[#111622] border border-slate-800 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">
                24/7 Synthetic Index Algorithmic Volatility &amp; Tick-Spike Profile
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Zero Macro News Catalyst · Cryptographic Tick Generation
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800/90">
              <span className="text-slate-400 block">Volatility &amp; Tick Engine</span>
              <strong className="text-white font-mono text-sm mt-1 block">
                {sp?.constantVolatilityPct || "Constant Algorithmic Variance"}
              </strong>
              <span className="text-slate-400 text-[11px] mt-1 block">
                {sp?.generationEngine || "24/7 Automated Tick Generator"}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800/90">
              <span className="text-slate-400 block">Mean-Reversion / Spike Band</span>
              <strong className="text-cyan-400 font-mono text-sm mt-1 block">
                {sp?.meanReversionSigma || "±2.5σ Volatility Envelope"}
              </strong>
              <span className="text-slate-400 text-[11px] mt-1 block">
                Filters mid-range random walks; triggers only at band extremes.
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-slate-800/90">
              <span className="text-slate-400 block">Execution Protocol</span>
              <p className="text-slate-200 text-xs mt-1 leading-relaxed">
                {sp?.preSpikeBaseRule ||
                  "Wait for LTF Market Structure Shift inside HTF Order Block + 0.705 OTE."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 5: STRUCTURED TRADE EXECUTION CARD & CONFLUENCE SCORE (0-100%) */}
      <div className="rounded-2xl bg-[#111622] border border-slate-800 p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>{symbol.marketType === "CRYPTO_PERP" ? "Crypto Perpetuals" : symbol.marketType === "SYNTHETIC" ? "Synthetic Indices" : `Forex ${symbol.subCategory || "Major"}`}</span>
              <span>·</span>
              <span className="font-mono">{symbol.ticker}</span>
              <span>·</span>
              <span className="font-mono">{timeframe} Timeframe</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium">
                {evaluation.alignedModulesCount}/5 Quantitative Modules Aligned
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {symbol.name} — Quantitative Execution Matrix
            </h2>
            <p className="text-xs font-mono text-cyan-400">
              {evaluation.confluenceFormulaBanner}
            </p>
          </div>

          {/* Directional Bias + Confluence Score Gauge */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-slate-800 text-right">
              <span className="text-[11px] text-slate-400 block">Directional Bias</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isBullish ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : isBearish ? (
                  <TrendingDown className="h-4 w-4 text-rose-400" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                )}
                <span
                  className={`text-sm font-bold font-mono ${
                    isBullish
                      ? "text-emerald-400"
                      : isBearish
                      ? "text-rose-400"
                      : "text-amber-400"
                  }`}
                >
                  {evaluation.directionalBias}
                </span>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-slate-800 text-right">
              <span className="text-[11px] text-slate-400 block">
                {evaluation.highProbabilityTrigger ? "High Probability Alert" : "Below Threshold (<3/5)"}
              </span>
              <span
                className={`text-xl font-bold font-mono tabular-nums ${
                  evaluation.confluenceScorePct >= 80
                    ? "text-emerald-400"
                    : evaluation.confluenceScorePct >= 65
                    ? "text-cyan-400"
                    : "text-amber-400"
                }`}
              >
                {evaluation.confluenceScorePct}%
              </span>
            </div>
          </div>
        </div>

        {/* EXECUTION LEVELS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0B0E14] border border-slate-800">
            <span className="text-xs text-slate-400 block">OTE Entry Zone (0.618–0.786)</span>
            <span className="text-sm font-mono font-bold text-white mt-1.5 block tabular-nums">
              {formatPrice(evaluation.executionCard.entryZoneLow, symbol)} –{" "}
              {formatPrice(evaluation.executionCard.entryZoneHigh, symbol)}
            </span>
            <span className="text-[11px] text-cyan-400 font-mono mt-1 block">
              {evaluation.executionCard.orderType}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0B0E14] border border-cyan-500/40">
            <span className="text-xs text-cyan-300 block">0.705 Institutional Sweet Spot</span>
            <span className="text-lg font-mono font-bold text-cyan-400 mt-1 block tabular-nums">
              {formatPrice(evaluation.executionCard.optimalEntry705, symbol)}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Primary Limit Execution Level
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0B0E14] border border-slate-800">
            <span className="text-xs text-slate-400 block">Invalidation Stop Loss (SL)</span>
            <span className="text-lg font-mono font-bold text-rose-400 mt-1 block tabular-nums">
              {formatPrice(evaluation.executionCard.invalidationSL, symbol)}
            </span>
            <span className="text-[11px] text-slate-400 mt-1 block truncate" title={evaluation.executionCard.atrBufferApplied}>
              {evaluation.executionCard.atrBufferApplied}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#0B0E14] border border-slate-800">
            <span className="text-xs text-slate-400 block">Calculated Risk-to-Reward</span>
            <span className="text-lg font-mono font-bold text-emerald-400 mt-1 block tabular-nums">
              {evaluation.executionCard.riskRewardRatio} R:R
            </span>
            <span className="text-[11px] text-emerald-400/90 mt-1 block">
              Exceeds Minimum 1:2.5 Mandate
            </span>
          </div>
        </div>

        {/* TIERED FIBONACCI EXTENSION TAKE-PROFIT TARGETS */}
        <div className="p-4 rounded-xl bg-[#0B0E14] border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">
                Projected Fibonacci Extension Take-Profit Targets
              </span>
            </div>
            {onSyncLevelsToWorkspace && (
              <button
                type="button"
                onClick={() =>
                  onSyncLevelsToWorkspace({
                    entry: evaluation.executionCard.optimalEntry705,
                    stopLoss: evaluation.executionCard.invalidationSL,
                    tp1: evaluation.executionCard.tp1_1272,
                    tp2: evaluation.executionCard.tp2_1618,
                  })
                }
                className="px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors cursor-pointer"
              >
                Plot Levels on Live Terminal Chart
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">TP1 · 1.272 Fib Extension (50% Scale-Out)</span>
                <span className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                  {formatPrice(evaluation.executionCard.tp1_1272, symbol)}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">Move SL → BE</span>
            </div>

            <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">TP2 · 1.618 Golden Extension (30% Scale-Out)</span>
                <span className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                  {formatPrice(evaluation.executionCard.tp2_1618, symbol)}
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                {evaluation.executionCard.riskRewardRatio} R:R
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#111622] border border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">TP3 · 2.000 Institutional Runner (20% Final)</span>
                <span className="text-sm font-mono font-bold text-emerald-400 tabular-nums">
                  {formatPrice(evaluation.executionCard.tp3_2000, symbol)}
                </span>
              </div>
              <span className="text-xs font-mono text-cyan-400">External Pool</span>
            </div>
          </div>
        </div>

        {/* DEALING RANGE & PREMIUM VS DISCOUNT (0.50 EQUILIBRIUM) BAR */}
        <div className="p-4 rounded-xl bg-[#0B0E14] border border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white">
              Dealing Range Equilibrium (0.50) &amp; ICT OTE (0.618 – 0.705 – 0.786) Filter
            </span>
            <span className="font-mono text-slate-400 tabular-nums">
              Swing Low: {formatPrice(evaluation.fibonacci.swingLow, symbol)} · Equilibrium (0.50):{" "}
              {formatPrice(evaluation.fibonacci.equilibrium50, symbol)} · Swing High:{" "}
              {formatPrice(evaluation.fibonacci.swingHigh, symbol)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div
              className={`p-2.5 rounded-lg border ${
                evaluation.fibonacci.currentZone === "DISCOUNT"
                  ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                  : "bg-[#111622] border-slate-800 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>DISCOUNT ZONE (&lt; 0.50) — LONGS ONLY</span>
                {evaluation.fibonacci.currentZone === "DISCOUNT" && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-300 tabular-nums">
                OTE 0.618: {formatPrice(evaluation.fibonacci.ote618, symbol)} ·{" "}
                <strong className="text-cyan-300">
                  0.705: {formatPrice(evaluation.fibonacci.ote705SweetSpot, symbol)}
                </strong>{" "}
                · 0.786: {formatPrice(evaluation.fibonacci.ote786, symbol)}
              </div>
            </div>

            <div
              className={`p-2.5 rounded-lg border ${
                evaluation.fibonacci.currentZone === "PREMIUM"
                  ? "bg-rose-950/30 border-rose-500/40 text-rose-300"
                  : "bg-[#111622] border-slate-800 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>PREMIUM ZONE (&gt; 0.50) — SHORTS ONLY</span>
                {evaluation.fibonacci.currentZone === "PREMIUM" && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-rose-400" />
                )}
              </div>
              <div className="mt-1 text-[11px] text-slate-300 tabular-nums">
                Strict Institutional Filter: Longs rejected in Premium; Shorts rejected in Discount.
              </div>
            </div>
          </div>
        </div>

        {/* 5-MODULE MULTI-FACTOR CONFLUENCE BREAKDOWN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Multi-Factor Quantitative Module Breakdown (5 Pillars)
            </h3>
            <span className="text-xs text-slate-400">
              Minimum 3 of 5 modules required for High Probability execution
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {evaluation.modules.map((mod) => (
              <div
                key={mod.id}
                className="p-4 rounded-xl bg-[#0B0E14] border border-slate-800 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {mod.aligned ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Shield className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                    <span className="text-xs font-mono text-slate-400">
                      0{mod.moduleNumber}.
                    </span>
                    <h4 className="text-sm font-semibold text-white">
                      {mod.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                    <span className={mod.aligned ? "text-emerald-400" : "text-amber-400"}>
                      {mod.aligned ? "Aligned" : "Pending"}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-white font-semibold">
                      {mod.score}/{mod.maxScore} pts
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {mod.summary}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  {mod.metrics.map((m, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-[#111622] border border-slate-800/80"
                    >
                      <span className="text-[11px] text-slate-400 block">
                        {m.label}
                      </span>
                      <span
                        className={`text-xs font-mono font-semibold mt-0.5 block tabular-nums ${
                          m.highlight ? "text-cyan-400" : "text-slate-200"
                        }`}
                      >
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
