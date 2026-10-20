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
    <div className="space-y-6 text-slate-900">
      {/* ASSET-SPECIFIC QUANTITATIVE TELEMETRY HEADER */}
      {symbol.marketType === "CRYPTO_PERP" && fm && (
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold font-display text-slate-900">
                {fm.exchange} Perpetual Futures Orderflow &amp; Liquidation Telemetry
              </h3>
            </div>
            <div className="text-xs text-slate-600 font-mono tabular-nums">
              <span className="font-semibold text-slate-900">{symbol.ticker}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span>Next Funding in {fundingCountdown}</span>
            </div>
          </div>

          {/* 3-Column Futures Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-lg bg-[#F8FAF9] border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Funding Rate ({fm.fundingIntervalHours}h)</span>
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span
                  className={`text-lg font-mono font-bold tabular-nums ${
                    fm.fundingRateNumeric >= 0 ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {fm.fundingRate}
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {fundingCountdown}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                {fm.fundingRateNumeric < 0
                  ? "Negative funding: crowded shorts vulnerable to BSL squeeze."
                  : "Positive funding: monitor OI flush on SSL sweeps for long entry."}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F8FAF9] border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Open Interest &amp; 24h Delta</span>
                <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                  {fm.openInterestUsd}
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-700 tabular-nums">
                  {fm.oiDelta24h}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                L/S Ratio: <strong className="text-slate-900 font-mono">{fm.longShortRatio.toFixed(2)}</strong> · CVD:{" "}
                <strong className="text-emerald-700 font-mono">
                  {fm.cvdBias.replace(/_/g, " ")}
                </strong>
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#F8FAF9] border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>High-Leverage Liquidation Pools</span>
                <Zap className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="mt-1.5 space-y-1 text-xs font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-600">100x Shorts (BSL):</span>
                  <span className="text-emerald-700 font-semibold">{fm.liquidationClusters.tier100xShort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">100x Longs (SSL):</span>
                  <span className="text-rose-600 font-semibold">{fm.liquidationClusters.tier100xLong}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>50x Cluster Range:</span>
                  <span>
                    {fm.liquidationClusters.tier50xLong} – {fm.liquidationClusters.tier50xShort}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {symbol.marketType === "SYNTHETIC" && sp && (
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold font-display text-slate-900">
                24/7 Synthetic Algorithmic Telemetry · {sp.generationEngine}
              </h3>
            </div>
            <span className="text-xs font-mono text-emerald-700 font-semibold">
              Zero Fundamental News Catalysts · Pure Price Action
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-[#F8FAF9] border border-slate-200">
              <span className="text-slate-500 block">Volatility Parameter</span>
              <span className="font-mono font-bold text-slate-900 mt-1 block">
                {sp.constantVolatilityPct}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#F8FAF9] border border-slate-200">
              <span className="text-slate-500 block">Mean-Reversion Band</span>
              <span className="font-mono font-bold text-emerald-700 mt-1 block">
                {sp.meanReversionSigma}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#F8FAF9] border border-slate-200">
              <span className="text-slate-500 block">Pre-Spike Consolidation Filter</span>
              <span className="text-slate-700 mt-1 block leading-snug">
                {sp.preSpikeBaseRule}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 5: DYNAMIC RISK & EXECUTION OUTPUT CARD */}
      <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Multi-Factor Confluence Engine</span>
              <span>·</span>
              <span className="font-mono text-slate-800 font-semibold">
                {symbol.ticker} ({timeframe})
              </span>
              <span>·</span>
              <span>
                {evaluation.alignedModulesCount} of 5 Modules Aligned
              </span>
            </div>
            <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2.5">
              {isBullish ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : isBearish ? (
                <TrendingDown className="h-5 w-5 text-rose-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <span>
                Directional Bias:{" "}
                <span
                  className={
                    isBullish
                      ? "text-emerald-700"
                      : isBearish
                      ? "text-rose-600"
                      : "text-amber-700"
                  }
                >
                  {evaluation.directionalBias}
                </span>
              </span>
            </h2>
          </div>

          {/* Total Confluence Score Gauge */}
          <div className="flex items-center gap-4 bg-[#F8FAF9] border border-slate-200 rounded-xl px-4 py-3 shrink-0">
            <div>
              <div className="text-[11px] text-slate-500">Confluence Score</div>
              <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums">
                {evaluation.confluenceScorePct}%
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-[11px] text-slate-500">Setup Status</div>
              <div
                className={`text-xs font-semibold ${
                  evaluation.highProbabilityTrigger
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {evaluation.highProbabilityTrigger
                  ? "High Probability (≥3/5 Aligned)"
                  : "Standby (<3 Modules)"}
              </div>
            </div>
          </div>
        </div>

        {/* Formula Summary Banner */}
        <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3.5 text-xs font-mono text-emerald-950 flex items-center justify-between gap-4">
          <span>{evaluation.confluenceFormulaBanner}</span>
          <span className="text-emerald-700 font-bold shrink-0 tabular-nums">
            R:R {evaluation.executionCard.riskRewardRatio}
          </span>
        </div>

        {/* Structured Trade Execution Coordinates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Entry Zone */}
          <div className="p-3.5 rounded-lg bg-[#F8FAF9] border border-slate-200 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Entry Zone (OTE)</span>
              <Target className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-sm font-mono font-bold text-slate-900 tabular-nums">
              {formatPrice(evaluation.executionCard.entryZoneLow, symbol)} –{" "}
              {formatPrice(evaluation.executionCard.entryZoneHigh, symbol)}
            </div>
            <div className="text-[11px] text-emerald-700 font-mono font-semibold tabular-nums">
              0.705 Sweet Spot:{" "}
              {formatPrice(evaluation.executionCard.optimalEntry705, symbol)}
            </div>
          </div>

          {/* Invalidation Stop Loss */}
          <div className="p-3.5 rounded-lg bg-rose-50/50 border border-rose-200 space-y-1">
            <div className="flex items-center justify-between text-xs text-rose-700">
              <span>Invalidation SL</span>
              <Shield className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div className="text-sm font-mono font-bold text-rose-700 tabular-nums">
              {formatPrice(evaluation.executionCard.invalidationSL, symbol)}
            </div>
            <div className="text-[11px] text-slate-600 leading-tight">
              {evaluation.executionCard.atrBufferApplied}
            </div>
          </div>

          {/* TP1 */}
          <div className="p-3.5 rounded-lg bg-[#F8FAF9] border border-slate-200 space-y-1">
            <div className="text-xs text-slate-500">TP1 (1.272 Fib Ext)</div>
            <div className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
              {formatPrice(evaluation.executionCard.tp1_1272, symbol)}
            </div>
            <div className="text-[11px] text-slate-500">
              Scale 40% &amp; move SL to BE
            </div>
          </div>

          {/* TP2 */}
          <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-1">
            <div className="text-xs text-emerald-800 font-medium">
              TP2 (1.618 Fib Ext)
            </div>
            <div className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
              {formatPrice(evaluation.executionCard.tp2_1618, symbol)}
            </div>
            <div className="text-[11px] text-emerald-800/80">
              Primary external pool target
            </div>
          </div>

          {/* TP3 */}
          <div className="p-3.5 rounded-lg bg-[#F8FAF9] border border-slate-200 space-y-1">
            <div className="text-xs text-slate-500">TP3 (2.0 Fib Runner)</div>
            <div className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
              {formatPrice(evaluation.executionCard.tp3_2000, symbol)}
            </div>
            <div className="text-[11px] text-slate-500">
              HTF expansion objective
            </div>
          </div>
        </div>

        {/* Sync Levels to Calculator / Chart Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
          <span className="text-slate-600">
            Order Type:{" "}
            <strong className="text-slate-900 font-mono">
              {evaluation.executionCard.orderType}
            </strong>{" "}
            · {evaluation.executionCard.atrBufferApplied}
          </span>
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
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Sync Levels to Risk Sizer &amp; Chart
            </button>
          )}
        </div>
      </div>

      {/* 5-MODULE CONFLUENCE BREAKDOWN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evaluation.modules.map((mod, idx) => {
          const pct = Math.round((mod.score / mod.maxScore) * 100);
          return (
            <div
              key={mod.id}
              className={`rounded-xl bg-white border border-slate-200 p-5 space-y-3 ${
                idx === 4 ? "md:col-span-2" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 font-mono">
                    0{idx + 1}. {mod.aligned ? "Aligned" : "Awaiting Trigger"}
                  </div>
                  <h3 className="text-sm font-bold font-display text-slate-900 mt-0.5">
                    {mod.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs shrink-0 tabular-nums">
                  {mod.aligned ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span
                    className={
                      mod.aligned
                        ? "text-emerald-700 font-bold"
                        : "text-amber-700 font-bold"
                    }
                  >
                    {mod.score}/{mod.maxScore} pts
                  </span>
                </div>
              </div>

              {/* Clean Score Bar */}
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    mod.aligned ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-xs text-slate-700 font-medium">{mod.summary}</p>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                {mod.metrics.map((m, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-slate-50 border border-slate-200/70"
                  >
                    <span className="text-[10px] text-slate-500 block">
                      {m.label}
                    </span>
                    <span
                      className={`font-mono font-semibold text-[11px] ${
                        m.highlight ? "text-emerald-700" : "text-slate-900"
                      }`}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAILED SMC & FIBONACCI TELEMETRY TABLE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-200 pb-2.5">
            SMC &amp; ICT Structural Mapping
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">HTF Structure (4H/1D)</span>
              <span className="font-mono text-slate-900 font-semibold text-right">
                {evaluation.smcStructure.htfStructure}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">LTF Trigger (15M/5M)</span>
              <span className="font-mono text-emerald-700 font-semibold text-right">
                {evaluation.smcStructure.ltfStructure}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Primary PD Array</span>
              <span className="font-mono text-slate-900 text-right">
                {evaluation.smcStructure.pdArrayType}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">PD Array Zone</span>
              <span className="font-mono text-slate-900 text-right tabular-nums">
                {evaluation.smcStructure.pdArrayZone}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Buy-Side Liquidity (BSL)</span>
              <span className="font-mono text-emerald-700 font-semibold text-right tabular-nums">
                {formatPrice(evaluation.smcStructure.bslPool, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Sell-Side Liquidity (SSL)</span>
              <span className="font-mono text-rose-600 font-semibold text-right tabular-nums">
                {formatPrice(evaluation.smcStructure.sslPool, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">ICT Killzone Status</span>
              <span className="font-mono text-slate-800 text-right">
                {evaluation.smcStructure.killzoneWindow}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-200 pb-2.5">
            Dynamic Fibonacci &amp; OTE Coordinates
          </h3>
          <div className="space-y-2 text-xs font-mono tabular-nums">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-sans">
                Confirmed Swing High
              </span>
              <span className="text-slate-900 font-semibold">
                {formatPrice(evaluation.fibonacci.swingHigh, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-sans">
                Confirmed Swing Low
              </span>
              <span className="text-slate-900 font-semibold">
                {formatPrice(evaluation.fibonacci.swingLow, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-sans">
                0.50 Equilibrium (EQ)
              </span>
              <span className="text-slate-800">
                {formatPrice(evaluation.fibonacci.equilibrium50, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-sans">
                0.618 Golden Pocket
              </span>
              <span className="text-emerald-700 font-semibold">
                {formatPrice(evaluation.fibonacci.ote618, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-emerald-800 font-sans font-semibold">
                0.705 Institutional OTE
              </span>
              <span className="text-emerald-700 font-bold">
                {formatPrice(evaluation.fibonacci.ote705SweetSpot, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-sans">
                0.786 Deep Retracement
              </span>
              <span className="text-emerald-700 font-semibold">
                {formatPrice(evaluation.fibonacci.ote786, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-sans">
                1.272 / 1.618 Targets
              </span>
              <span className="text-emerald-700 font-semibold">
                {formatPrice(evaluation.fibonacci.ext1272_TP1, symbol)} ·{" "}
                {formatPrice(evaluation.fibonacci.ext1618_TP2, symbol)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
