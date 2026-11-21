import React, { useEffect, useState, useMemo } from "react";
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
  Activity,
} from "lucide-react";
import { SyntheticSymbol } from "../data/symbols";
import {
  evaluateStructuralScan,
  evaluateLiveTick,
  formatPrice,
  getNextFundingCountdown,
  QuantitativeEvaluation,
  StructuralScanResult,
  TradingStyle,
} from "../lib/quantEngine";
import { useMarketData } from "../hooks/useMarketData";

interface QuantAnalyzerPanelProps {
  symbol: SyntheticSymbol;
  timeframe: string;
  tradingStyle?: TradingStyle;
  onTradingStyleChange?: (style: TradingStyle) => void;
  aiAnalysisResult?: any;
  onEvaluationChange?: (evaluation: QuantitativeEvaluation) => void;
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
  tradingStyle = "NORMAL" as TradingStyle,
  onTradingStyleChange,
  aiAnalysisResult,
  onEvaluationChange,
  onSyncLevelsToWorkspace,
}) => {
  const [fundingCountdown, setFundingCountdown] = useState<string>(getNextFundingCountdown());

  const { candles, latestCandle, futuresTelemetry, telemetry, mtfCandles, isMtfLoading, smtReference } =
    useMarketData(symbol, timeframe);

  useEffect(() => {
    const timer = setInterval(() => {
      setFundingCountdown(getNextFundingCountdown());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const structural: StructuralScanResult = useMemo(() => {
    return evaluateStructuralScan(candles, symbol, timeframe, aiAnalysisResult, mtfCandles, smtReference);
  }, [candles, symbol.ticker, timeframe, aiAnalysisResult, mtfCandles, smtReference]);

  const evaluation: QuantitativeEvaluation = useMemo(() => {
    const fallbackPrice = latestCandle?.close || structural.optimalEntry;
    const currentLiveCandle = latestCandle || {
      timestamp: Math.floor(Date.now() / 1000),
      open: fallbackPrice,
      high: fallbackPrice,
      low: fallbackPrice,
      close: fallbackPrice,
      volume: 0,
      isClosed: false,
    };

    return evaluateLiveTick(currentLiveCandle, structural, futuresTelemetry, tradingStyle);
  }, [latestCandle, structural, futuresTelemetry, tradingStyle]);

  useEffect(() => {
    onEvaluationChange?.(evaluation);
  }, [evaluation]);

  const isBullish = evaluation.directionalBias === "BULLISH";
  const isBearish = evaluation.directionalBias === "BEARISH";
  const isScalp = tradingStyle === "SCALP";
  const fm = futuresTelemetry || symbol.futuresMetrics;
  const sm = evaluation.syntheticMetrics;

  return (
    <div className="space-y-5 text-slate-900">
      {/* LIVE TREND CHECK STRIP (1D / 4H / ACTIVE TF) */}
      <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Layers className="h-4 w-4 text-emerald-600" />
            <span>Live Trend Direction Check</span>
          </div>
          <span className="font-mono text-slate-600">
            {isMtfLoading ? "Loading 1D & 4H trend..." : evaluation.mtfAlignment.alignmentNote}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {[evaluation.mtfAlignment.d1, evaluation.mtfAlignment.h4, evaluation.mtfAlignment.execution].map(
            (tfItem, idx) => {
              const bColor =
                tfItem.bias === "BULLISH"
                  ? "text-emerald-700"
                  : tfItem.bias === "BEARISH"
                  ? "text-rose-600"
                  : "text-amber-700";
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300 flex items-center justify-between gap-2"
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
                      {tfItem.timeframe} Trend ({tfItem.candleCount} bars)
                    </span>
                    <span className="text-slate-800 font-medium block mt-0.5">{tfItem.structureEvent}</span>
                  </div>
                  <span className={`font-mono font-bold text-xs shrink-0 ${bColor}`}>{tfItem.bias}</span>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* LIVE TRADE SETUP CARD (SCALP vs NORMAL TRADE SWITCHER) */}
      <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-300 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-800">
                {evaluation.executionCard.styleLabel}
              </span>
              <span>·</span>
              <span className="font-mono text-slate-800 font-semibold">
                {symbol.ticker} ({timeframe})
              </span>
              <span>·</span>
              <span>Est. Hold: {evaluation.executionCard.holdTime}</span>
              <span>·</span>
              <span>{evaluation.alignedModulesCount} of 5 Checks Passed</span>
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
                {isScalp ? "Scalp Signal:" : "Normal Trade Signal:"}{" "}
                <span
                  className={
                    isBullish ? "text-emerald-700" : isBearish ? "text-rose-600" : "text-amber-700"
                  }
                >
                  {evaluation.executionCard.orderType} ({evaluation.directionalBias})
                </span>
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onTradingStyleChange && (
              <div className="grid grid-cols-2 gap-1 bg-[#DFE4EB] p-1 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => onTradingStyleChange("SCALP")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    isScalp
                      ? "bg-emerald-600 text-white"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Scalp Setup
                </button>
                <button
                  type="button"
                  onClick={() => onTradingStyleChange("NORMAL")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    !isScalp
                      ? "bg-emerald-600 text-white"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Normal Trade
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 bg-[#E8ECF2] border border-slate-300 rounded-xl px-4 py-2.5">
              <div>
                <div className="text-[10px] text-slate-500">Setup Score</div>
                <div
                  className={`text-xl font-mono font-bold tabular-nums ${
                    evaluation.highProbabilityTrigger ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {evaluation.confluenceScorePct}%
                </div>
              </div>
              <div className="h-7 w-px bg-slate-300" />
              <div>
                <div className="text-[10px] text-slate-500">Status</div>
                <div
                  className={`text-xs font-semibold ${
                    evaluation.highProbabilityTrigger ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {evaluation.highProbabilityTrigger ? "Setup Ready" : "Wait for Setup"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formula Summary Banner */}
        <div
          className={`rounded-lg border p-3.5 text-xs font-mono flex items-center justify-between gap-4 ${
            evaluation.highProbabilityTrigger
              ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
              : "bg-amber-50/70 border-amber-300 text-amber-950"
          }`}
        >
          <span>{evaluation.confluenceFormulaBanner}</span>
          <span className="font-bold shrink-0 tabular-nums">
            Risk:Reward {evaluation.executionCard.riskRewardRatio}
          </span>
        </div>

        {/* Trade Levels Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{isScalp ? "Scalp Entry Zone" : "Normal Entry Zone"}</span>
              <Target className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-sm font-mono font-bold text-slate-900 tabular-nums">
              {formatPrice(evaluation.executionCard.entryZoneLow, symbol)} –{" "}
              {formatPrice(evaluation.executionCard.entryZoneHigh, symbol)}
            </div>
            <div className="text-[11px] text-emerald-700 font-mono font-semibold tabular-nums">
              Best Entry: {formatPrice(evaluation.executionCard.optimalEntry705, symbol)}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-rose-50/50 border border-rose-300 space-y-1">
            <div className="flex items-center justify-between text-xs text-rose-700">
              <span>{isScalp ? "Tight Scalp SL" : "Safe Swing SL"}</span>
              <Shield className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div className="text-sm font-mono font-bold text-rose-700 tabular-nums">
              {formatPrice(evaluation.executionCard.invalidationSL, symbol)}
            </div>
            <div className="text-[11px] text-slate-600 leading-tight">
              {evaluation.executionCard.atrBufferApplied}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <div className="text-xs text-slate-500">
              TP1 ({isScalp ? "Quick 1.2R" : "Partial 1.5R"})
            </div>
            <div className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
              {formatPrice(evaluation.executionCard.tp1_1272, symbol)}
            </div>
            <div className="text-[11px] text-slate-500">
              {isScalp ? "Take 50% & move SL to BE" : "Take 40% & move SL to BE"}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-300 space-y-1">
            <div className="text-xs text-emerald-800 font-medium">
              TP2 ({isScalp ? "Main 1.8R" : "Main 2.5R"})
            </div>
            <div className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
              {formatPrice(evaluation.executionCard.tp2_1618, symbol)}
            </div>
            <div className="text-[11px] text-emerald-800/80">Primary profit target</div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <div className="text-xs text-slate-500">
              TP3 ({isScalp ? "Runner 2.5R" : "Swing 3.5R"})
            </div>
            <div className="text-sm font-mono font-bold text-emerald-700 tabular-nums">
              {formatPrice(evaluation.executionCard.tp3_2000, symbol)}
            </div>
            <div className="text-[11px] text-slate-500">Extended runner target</div>
          </div>
        </div>

        {/* Quick Side-by-Side Comparison: Scalp vs Normal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono tabular-nums">
          {(["scalp", "normal"] as const).map((key) => {
            const p = evaluation.tradePlans[key];
            const isSelected = (key === "scalp" && isScalp) || (key === "normal" && !isScalp);
            return (
              <div
                key={key}
                onClick={() => onTradingStyleChange?.(p.style)}
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-emerald-50/60 border-emerald-400"
                    : "bg-[#E8ECF2] border-slate-300 hover:border-slate-400"
                }`}
              >
                <div className="flex items-center justify-between font-sans mb-1.5">
                  <span className="font-bold text-slate-900">{p.label}</span>
                  <span className="text-[11px] font-mono text-slate-600">{p.holdTime}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700">
                  <span>
                    Entry: <strong className="text-slate-900">{formatPrice(p.entry, symbol)}</strong>
                  </span>
                  <span>
                    SL: <strong className="text-rose-700">{formatPrice(p.stopLoss, symbol)}</strong>
                  </span>
                  <span>
                    TP2: <strong className="text-emerald-700">{formatPrice(p.tp2, symbol)}</strong>
                  </span>
                  <span className="text-emerald-800 font-semibold">{p.riskRewardRatio}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-300 text-xs">
          <span className="text-slate-600">
            Action:{" "}
            <strong className="text-slate-900 font-mono">{evaluation.executionCard.orderType}</strong> ·{" "}
            {telemetry.activeCandleCount} live candles loaded
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
              Send Levels to Risk Sizer &amp; Chart
            </button>
          )}
        </div>
      </div>

      {/* ASSET-SPECIFIC LIVE TELEMETRY */}
      {symbol.marketType === "CRYPTO_PERP" && fm && (
        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-3">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold font-display text-slate-900">
                Crypto Futures Momentum (Funding, Open Interest &amp; Live Pressure)
              </h3>
            </div>
            <div className="text-xs text-slate-600 font-mono tabular-nums">
              <span className="font-semibold text-slate-900">{symbol.ticker}</span>
              <span className="mx-2 text-slate-400">·</span>
              <span>Next Funding: {fundingCountdown}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Funding Rate (8h)</span>
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span
                  className={`text-lg font-mono font-bold tabular-nums ${
                    (futuresTelemetry?.fundingRate ?? 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {futuresTelemetry
                    ? `${(futuresTelemetry.fundingRate * 100).toFixed(4)}%`
                    : (fm as any).fundingRate || "+0.0100%"}
                </span>
                <span className="text-xs font-mono text-slate-500 tabular-nums">{fundingCountdown}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                {(futuresTelemetry?.fundingRate ?? 0) < 0
                  ? "Negative funding — shorts crowded, watch for upside bounce."
                  : "Positive funding — wait for clean dips before buying."}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Open Interest &amp; 24h Change</span>
                <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-lg font-mono font-bold text-slate-900 tabular-nums">
                  {futuresTelemetry && futuresTelemetry.openInterestValue > 0
                    ? `$${(futuresTelemetry.openInterestValue / 1e9).toFixed(2)}B`
                    : (fm as any).openInterestUsd || "Syncing..."}
                </span>
                <span
                  className={`text-xs font-mono font-semibold tabular-nums ${
                    (futuresTelemetry?.oiDeltaPct24h ?? 0) >= 0 ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {futuresTelemetry?.oiDeltaPct24h !== undefined
                    ? `${futuresTelemetry.oiDeltaPct24h > 0 ? "+" : ""}${futuresTelemetry.oiDeltaPct24h}%`
                    : "Live"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 font-mono">
                Mark {formatPrice(futuresTelemetry?.markPrice || symbol.defaultPrice, symbol)} · Index{" "}
                {formatPrice(futuresTelemetry?.indexPrice || symbol.defaultPrice, symbol)}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Live Buying / Selling Pressure</span>
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="mt-1.5">
                <span
                  className={`text-sm font-mono font-bold ${
                    futuresTelemetry?.cvdBias === "BULLISH_ABSORPTION"
                      ? "text-emerald-700"
                      : futuresTelemetry?.cvdBias === "BEARISH_DISTRIBUTION"
                      ? "text-rose-600"
                      : "text-slate-800"
                  }`}
                >
                  {(futuresTelemetry?.cvdBias || "NEUTRAL").replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600">
                Calculated from live market buy vs. sell orders.
              </p>
            </div>
          </div>
        </div>
      )}

      {symbol.marketType === "SYNTHETIC" && sm && (
        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold font-display text-slate-900">
                Synthetic Volatility &amp; Spike Monitor
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {sm.isSpikeAsset ? "Boom/Crash Spike Watch" : "Overbought / Oversold Meter"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-slate-500 font-sans block">20-Candle Stretch (Z-Score)</span>
              <span
                className={`font-bold text-base mt-0.5 block ${
                  Math.abs(sm.zScore20) >= 2.0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {sm.zScore20 > 0 ? "+" : ""}
                {sm.zScore20}σ ({sm.regime.replace(/_/g, " ")})
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-slate-500 font-sans block">
                {sm.isSpikeAsset ? "Candles Since Last Spike" : "20-Candle Average"}
              </span>
              <span className="text-slate-900 font-bold text-base mt-0.5 block">
                {sm.isSpikeAsset
                  ? `${sm.barsSinceLastSpike} bars (Avg ${sm.avgInterSpikeBars})`
                  : `${formatPrice(sm.sma20, symbol)} ± ${formatPrice(sm.stdDev20, symbol)}`}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-slate-500 font-sans block">
                {sm.isSpikeAsset ? "Candle Tightness" : "Market Speed"}
              </span>
              <span className="text-slate-900 font-semibold mt-1 block">
                {sm.isSpikeAsset
                  ? `${sm.compressionRatio}x normal range`
                  : symbol.syntheticProfile?.constantVolatilityPct || "24/7 Synthetic Index"}
              </span>
            </div>
          </div>
        </div>
      )}

      {symbol.marketType === "FOREX" && (
        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              <span>
                Related Pair Check ({symbol.ticker} vs {evaluation.smtDivergence.referenceName || "Benchmark"})
              </span>
            </div>
            <p className="text-slate-600">{evaluation.smtDivergence.summary}</p>
          </div>
          <span
            className={`font-mono font-bold shrink-0 ${
              evaluation.smtDivergence.status === "BULLISH_SMT"
                ? "text-emerald-700"
                : evaluation.smtDivergence.status === "BEARISH_SMT"
                ? "text-rose-600"
                : "text-slate-700"
            }`}
          >
            {evaluation.smtDivergence.status.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {/* 5-POINT SETUP CHECKLIST GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evaluation.modules.map((mod, idx) => {
          const pct = Math.round((mod.score / mod.maxScore) * 100);
          return (
            <div
              key={mod.id}
              className={`rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3 ${
                idx === 4 ? "md:col-span-2" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500 font-mono">
                    0{idx + 1}. {mod.aligned ? "Passed" : "Waiting"}
                  </div>
                  <h3 className="text-sm font-bold font-display text-slate-900 mt-0.5">{mod.title}</h3>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs shrink-0 tabular-nums">
                  {mod.aligned ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span className={mod.aligned ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                    {mod.score}/{mod.maxScore} pts
                  </span>
                </div>
              </div>

              <div className="h-1.5 w-full rounded-full bg-slate-300/70 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    mod.aligned ? "bg-emerald-600" : "bg-amber-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-xs text-slate-700 font-medium">{mod.summary}</p>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-300/70 text-xs">
                {mod.metrics.map((m, i) => (
                  <div key={i} className="p-2 rounded bg-[#E8ECF2] border border-slate-300/80">
                    <span className="text-[10px] text-slate-500 block">{m.label}</span>
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

      {/* KEY ZONES & LEVELS REFERENCE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-300 pb-2.5">
            Key Support / Resistance Zones &amp; Price Gaps
          </h3>
          <div className="space-y-2 text-xs font-mono tabular-nums">
            {evaluation.overlays.orderBlocks.length === 0 && evaluation.overlays.fairValueGaps.length === 0 ? (
              <p className="font-sans text-slate-500 py-2">
                Scanning live candles for strong support/resistance zones and open price gaps...
              </p>
            ) : (
              <>
                {evaluation.overlays.orderBlocks.slice(-2).map((ob, idx) => (
                  <div
                    key={`ob-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#E8ECF2] border border-slate-300"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block font-sans">
                        {ob.type.includes("BULL") ? "Support / Buy Zone" : "Resistance / Sell Zone"} ({ob.status})
                      </span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        Move strength {ob.displacementAtrMultiple}× ATR
                      </span>
                    </div>
                    <span className="text-emerald-700 font-semibold">
                      {formatPrice(ob.bottom, symbol)} – {formatPrice(ob.top, symbol)}
                    </span>
                  </div>
                ))}
                {evaluation.overlays.fairValueGaps.slice(-2).map((fvg, idx) => (
                  <div
                    key={`fvg-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#E8ECF2] border border-slate-300"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block font-sans">
                        {fvg.type === "BULLISH" ? "Bullish" : "Bearish"} Price Gap ({fvg.status})
                      </span>
                      <span className="text-[10px] text-slate-500 font-sans">
                        Midpoint: {formatPrice(fvg.midpointCE, symbol)}
                      </span>
                    </div>
                    <span className="text-slate-800 font-semibold">
                      {formatPrice(fvg.bottom, symbol)} – {formatPrice(fvg.top, symbol)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-300 pb-2.5">
            Important Daily &amp; Pullback Levels
          </h3>
          <div className="space-y-2 text-xs font-mono tabular-nums">
            <div className="flex justify-between py-1 border-b border-slate-300/70">
              <span className="text-slate-500 font-sans">Yesterday High / Low</span>
              <span className="text-slate-900 font-semibold">
                {evaluation.smcStructure.pdh ? formatPrice(evaluation.smcStructure.pdh, symbol) : "—"} /{" "}
                {evaluation.smcStructure.pdl ? formatPrice(evaluation.smcStructure.pdl, symbol) : "—"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-300/70">
              <span className="text-slate-500 font-sans">Asian Session High / Low</span>
              <span className="text-slate-900 font-semibold">
                {evaluation.smcStructure.asianHigh ? formatPrice(evaluation.smcStructure.asianHigh, symbol) : "—"} /{" "}
                {evaluation.smcStructure.asianLow ? formatPrice(evaluation.smcStructure.asianLow, symbol) : "—"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-300/70">
              <span className="text-slate-500 font-sans">50% Range Midpoint</span>
              <span className="text-slate-900 font-semibold">
                {formatPrice(evaluation.fibonacci.equilibrium50, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-300/70">
              <span className="text-emerald-800 font-sans font-semibold">Key Pullback Level (70.5%)</span>
              <span className="text-emerald-700 font-bold">
                {formatPrice(evaluation.fibonacci.ote705SweetSpot, symbol)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 font-sans">Nearest High / Low Targets</span>
              <span className="text-slate-900 font-semibold">
                {formatPrice(evaluation.smcStructure.bslPool, symbol)} /{" "}
                {formatPrice(evaluation.smcStructure.sslPool, symbol)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
