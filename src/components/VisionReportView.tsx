import React, { useState } from "react";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Layers,
  Target,
  CheckCircle2,
  XCircle,
  Download,
  Sliders,
  Compass,
  Zap,
  Sparkles,
  BookOpen,
  Globe,
  ExternalLink,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { SyntheticSymbol } from "../data/symbols";
import { TradingStyle } from "../lib/quantEngine";

interface VisionReportViewProps {
  analysis: any;
  symbol: SyntheticSymbol;
  timeframe: string;
  tradingStyle?: TradingStyle;
  onSyncLevels?: (levels: { entry: number; stopLoss: number; tp1: number; tp2: number }) => void;
  onDownloadPDF?: () => void;
}

export const VisionReportView: React.FC<VisionReportViewProps> = ({
  analysis,
  symbol,
  timeframe,
  tradingStyle,
  onSyncLevels,
  onDownloadPDF,
}) => {
  const initialStyle: TradingStyle =
    analysis?.tradingStyle === "SCALP" || analysis?.tradingStyle === "NORMAL"
      ? analysis.tradingStyle
      : tradingStyle || "NORMAL";

  const [selectedPlanView, setSelectedPlanView] = useState<TradingStyle>(initialStyle);

  if (!analysis) return null;

  const isHybridAi = analysis.engineMode === "HYBRID_AI_VISION";
  const bias = String(analysis.bias || "NEUTRAL").toUpperCase();
  const isBull = bias === "BULLISH";
  const isBear = bias === "BEARISH";

  const hasDualPlans = Boolean(analysis.scalpPlan && analysis.normalPlan);
  const activeStyle: TradingStyle = hasDualPlans ? selectedPlanView : initialStyle;
  const activeStylePlan =
    hasDualPlans
      ? activeStyle === "SCALP"
        ? analysis.scalpPlan
        : analysis.normalPlan
      : null;

  const setupType = String(
    activeStylePlan?.type || analysis.tradeSetup?.type || "WAIT"
  ).toUpperCase();
  const displayEntry = activeStylePlan?.entry ?? analysis.tradeSetup?.entry;
  const displaySL = activeStylePlan?.stopLoss ?? analysis.tradeSetup?.stopLoss;
  const displayTP1 = activeStylePlan?.tp1 ?? analysis.tradeSetup?.takeProfits?.[0];
  const displayTP2 = activeStylePlan?.tp2 ?? analysis.tradeSetup?.takeProfits?.[1];
  const displayTP3 = activeStylePlan?.tp3 ?? analysis.tradeSetup?.takeProfits?.[2];
  const displayRR = activeStylePlan?.riskRewardRatio || analysis.tradeSetup?.riskRewardRatio || "N/A";
  const holdTime =
    activeStylePlan?.holdTime ||
    analysis.estimatedHoldTime ||
    (activeStyle === "SCALP" ? "5 – 45 mins" : "2 – 24 hours");
  const styleHeading =
    activeStyle === "SCALP" ? "Scalp Setup" : "Normal Trade Setup";

  const mtf = analysis.multiTimeframe || {};
  const d1Text = mtf.htfBias1D || mtf.trend1D || "Checking Daily trend";
  const h4Text = mtf.intermediateStructure4H || mtf.intermediateZone4H || "Checking 4H trend";
  const ltfText = mtf.entryPrecision30M || `Entry plan on ${timeframe}`;

  const antiSl = analysis.antiStopLossShield;
  const po3 = analysis.powerOf3;
  const judas = analysis.judasSwing;
  const crt = analysis.candleRangeTheory;
  const kz = analysis.killZone;
  const sb = analysis.silverBullet;
  const fib = analysis.fibonacciRetracement;

  const fmt = (val: any) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n === 0) return "—";
    if (symbol.pointMultiplier >= 10000) return n.toFixed(5);
    if (symbol.pointMultiplier >= 1000) return n.toFixed(3);
    if (symbol.defaultPrice >= 1000) return n.toFixed(2);
    if (symbol.defaultPrice < 2) return n.toFixed(4);
    return n.toFixed(2);
  };

  return (
    <div className="space-y-5 text-slate-900">
      {/* TOP TRADE VERDICT & STYLE CARD */}
      <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-300 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                {isHybridAi
                  ? `AI + Live Chart Analysis (${analysis.modelUsed || "Gemini 4"})`
                  : `Live Price-Action Engine (${analysis.modelUsed || "Live Candles"})`}
              </span>
              <span className="text-slate-400">·</span>
              <span>
                {symbol.ticker} ({timeframe})
              </span>
              <span className="text-slate-400">·</span>
              <span>Est. Hold: {holdTime}</span>
              {analysis.alignedModulesCount !== undefined && (
                <>
                  <span className="text-slate-400">·</span>
                  <span>{analysis.alignedModulesCount}/5 Checks Passed</span>
                </>
              )}
            </div>

            <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2.5">
              {isBull ? (
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              ) : isBear ? (
                <TrendingDown className="h-5 w-5 text-rose-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <span>
                {styleHeading}:{" "}
                <span
                  className={
                    setupType === "BUY"
                      ? "text-emerald-700"
                      : setupType === "SELL"
                      ? "text-rose-600"
                      : "text-amber-700"
                  }
                >
                  {setupType} ({bias})
                </span>
              </span>
            </h2>
            <p className="text-xs text-slate-600">{analysis.marketStructure}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="px-4 py-2 rounded-lg bg-[#E8ECF2] border border-slate-300 text-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
                Setup Score
              </span>
              <span className="text-lg font-mono font-bold text-emerald-700 tabular-nums">
                {analysis.confluenceScorePct ?? Math.round((Number(analysis.confluenceScore || 3) / 5) * 100)}%
              </span>
            </div>

            {onSyncLevels && Number(displayEntry) > 0 && (
              <button
                type="button"
                onClick={() =>
                  onSyncLevels({
                    entry: Number(displayEntry),
                    stopLoss: Number(displaySL),
                    tp1: Number(displayTP1 || displayEntry),
                    tp2: Number(displayTP2 || displayEntry),
                  })
                }
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Sync to Chart &amp; Sizer</span>
              </button>
            )}

            {onDownloadPDF && (
              <button
                type="button"
                onClick={onDownloadPDF}
                className="px-3.5 py-2 rounded-lg bg-[#E8ECF2] hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF Report</span>
              </button>
            )}
          </div>
        </div>

        {/* SCALP vs NORMAL TRADE SWITCHER RIGHT INSIDE THE REPORT */}
        {hasDualPlans && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">View Trade Style:</span>{" "}
              Switch anytime between a quick Scalp plan and a Normal day/swing plan.
            </div>
            <div className="grid grid-cols-2 gap-1 bg-[#DFE4EB] p-1 rounded-lg border border-slate-300 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPlanView("SCALP")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeStyle === "SCALP"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Scalp Setup (5–45m)
              </button>
              <button
                type="button"
                onClick={() => setSelectedPlanView("NORMAL")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeStyle === "NORMAL"
                    ? "bg-emerald-600 text-white"
                    : "text-slate-700 hover:text-slate-900"
                }`}
              >
                Normal Trade (2–24h)
              </button>
            </div>
          </div>
        )}

        {analysis.engineNotice && !isHybridAi && (
          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-300 text-xs text-amber-900">
            <strong>Live Mode Note:</strong> {analysis.engineNotice}
          </div>
        )}

        {/* TRADE LEVELS STRIP */}
        {analysis.tradeSetup && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono tabular-nums">
            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-[10px] font-sans uppercase text-slate-500 block font-semibold">
                {activeStyle === "SCALP" ? "Scalp Entry" : "Entry Price"}
              </span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {setupType} · {fmt(displayEntry)}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-rose-50/60 border border-rose-300">
              <span className="text-[10px] font-sans uppercase text-rose-700 block font-semibold">
                Stop Loss
              </span>
              <span className="text-sm font-bold text-rose-700 mt-1 block">
                {fmt(displaySL)}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-[10px] font-sans uppercase text-slate-500 block font-semibold">
                TP1 ({activeStyle === "SCALP" ? "Quick 50%" : "Partial 40%"})
              </span>
              <span className="text-sm font-bold text-emerald-700 mt-1 block">
                {fmt(displayTP1)}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-300">
              <span className="text-[10px] font-sans uppercase text-emerald-800 block font-semibold">
                TP2 (Main Target)
              </span>
              <span className="text-sm font-bold text-emerald-700 mt-1 block">
                {fmt(displayTP2)}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-[10px] font-sans uppercase text-slate-500 block font-semibold">
                TP3 / Risk-Reward
              </span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {fmt(displayTP3)} · {displayRR}
              </span>
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 text-xs text-slate-700 space-y-1.5">
          <div className="font-semibold text-slate-900">Trade Summary</div>
          <p className="leading-relaxed">{analysis.tradeSetup?.rationale || analysis.detailedVisualDescription}</p>
          {analysis.suggestedRisk && (
            <p className="text-slate-600 pt-1 border-t border-slate-300/80 font-mono">
              Risk Plan: {analysis.suggestedRisk}
            </p>
          )}
        </div>
      </div>

      {/* AI KNOWLEDGE ENGINE TELEMETRY: LIVE NEWS RISK + RISK CRITIC + MARKET REGIME */}
      {(analysis.newsRisk || analysis.riskCritic || analysis.marketRegime) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LIVE NEWS & ECONOMIC EVENT RISK */}
          {analysis.newsRisk && (
            <div
              className={`rounded-xl border p-4 space-y-2.5 text-xs ${
                analysis.newsRisk.level === "HIGH"
                  ? "bg-rose-50/90 border-rose-300"
                  : analysis.newsRisk.level === "MEDIUM"
                  ? "bg-amber-50/90 border-amber-300"
                  : "bg-[#F1F4F8] border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  <span>Live News &amp; Event Risk</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    analysis.newsRisk.level === "HIGH"
                      ? "bg-rose-600 text-white"
                      : analysis.newsRisk.level === "MEDIUM"
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {analysis.newsRisk.level} RISK
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed">{analysis.newsRisk.summary}</p>
              {Array.isArray(analysis.newsRisk.sources) && analysis.newsRisk.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {analysis.newsRisk.sources.map((src: any, idx: number) => (
                    <a
                      key={idx}
                      href={src.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-300 text-[10px] font-medium text-emerald-800 hover:border-emerald-500"
                    >
                      <span className="truncate max-w-[160px]">{src.title}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI RISK CRITIC VERIFICATION */}
          {analysis.riskCritic && (
            <div
              className={`rounded-xl border p-4 space-y-2.5 text-xs ${
                analysis.riskCritic.passed
                  ? "bg-[#F1F4F8] border-slate-300"
                  : analysis.riskCritic.verdictAdjusted
                  ? "bg-rose-50/90 border-rose-300"
                  : "bg-amber-50/90 border-amber-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  {analysis.riskCritic.passed ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <span>AI Risk Critic Verification</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    analysis.riskCritic.passed
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-600 text-white"
                  }`}
                >
                  {analysis.riskCritic.passed ? "7/7 PASSED" : `${analysis.riskCritic.warnings?.length || 1} FLAG`}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed">{analysis.riskCritic.summary}</p>
              {Array.isArray(analysis.riskCritic.warnings) && analysis.riskCritic.warnings.length > 0 && (
                <ul className="space-y-1 text-[11px] text-slate-800 list-disc pl-4">
                  {analysis.riskCritic.warnings.map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* MARKET REGIME & PLAYBOOK STRIP */}
          {analysis.marketRegime && (
            <div className="lg:col-span-2 rounded-xl bg-[#F1F4F8] border border-slate-300 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900">
                    Market Regime: {analysis.marketRegime.regimeLabel}
                  </span>
                  {analysis.playbookTitle && (
                    <span className="ml-2 text-[11px] font-mono text-emerald-700">
                      · {analysis.playbookTitle}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
                <span className="px-2 py-1 rounded bg-[#E8ECF2] border border-slate-300 text-slate-800">
                  ADX {analysis.marketRegime.adx14}
                </span>
                <span className="px-2 py-1 rounded bg-[#E8ECF2] border border-slate-300 text-slate-800">
                  RSI(14) {analysis.marketRegime.rsi14}
                </span>
                <span className="px-2 py-1 rounded bg-[#E8ECF2] border border-slate-300 text-slate-800">
                  VWAP {fmt(analysis.marketRegime.vwap)}
                </span>
                <span className="px-2 py-1 rounded bg-[#E8ECF2] border border-slate-300 text-slate-800">
                  EMA20 {fmt(analysis.marketRegime.ema20)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STOP LOSS PROTECTION & SESSION TIMING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {antiSl && (
          <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
              <h3 className="text-sm font-bold font-display text-slate-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                Stop Loss Safety Check
              </h3>
              <span className="text-xs font-mono font-semibold text-slate-700">
                {activeStyle === "SCALP" ? "Tight Scalp Stop" : "Swing Stop"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs tabular-nums">
              <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">Safe Stop Loss Level</span>
                <span className="text-sm font-bold text-rose-700 mt-0.5 block">
                  {fmt(displaySL || antiSl.structuralInvalidationPrice)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">Stop Distance</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                  {fmt(Math.abs(Number(displayEntry || 0) - Number(displaySL || 0)))}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{antiSl.protectionRationale}</p>
          </div>
        )}

        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
            <h3 className="text-sm font-bold font-display text-slate-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Market Session &amp; Volatility
            </h3>
            <span className="text-xs font-mono font-semibold text-slate-700">
              {kz?.status === "INACTIVE" ? "Quiet Hours" : "Active Hours"}
            </span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Current Session</span>
                <span className="font-mono text-emerald-700">{kz?.windowName || "Standard Session"}</span>
              </div>
              <p className="text-slate-600 mt-1">{kz?.details || "Checking current market movement and spreads."}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Momentum Window</span>
                <span className="font-mono text-slate-700">{sb?.windowName || "Normal Volume"}</span>
              </div>
              <p className="text-slate-600 mt-1">{sb?.details || "Best volatility usually happens during London & New York opens."}</p>
            </div>
          </div>
        </div>
      </div>

      {/* HIGHER TIMEFRAME TREND CHECK */}
      <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
          <h3 className="text-sm font-bold font-display text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            Trend Check Across Timeframes (1D → 4H → {timeframe})
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">Daily (1D) Trend</span>
            <p className="text-slate-800 font-medium leading-relaxed">{d1Text}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">4-Hour (4H) Trend</span>
            <p className="text-slate-800 font-medium leading-relaxed">{h4Text}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">{timeframe} Entry Timing</span>
            <p className="text-slate-800 font-medium leading-relaxed">{ltfText}</p>
          </div>
        </div>
        {mtf.confirmationMessage && (
          <p className="text-xs text-slate-600 font-mono">{mtf.confirmationMessage}</p>
        )}
      </div>

      {/* RANGE, FAKEOUT & TARGET WATCH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {po3 && (
          <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold font-display text-slate-900 flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-emerald-600" />
                Session Range &amp; Target
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {po3.detected ? "Mapped" : "Forming"}
              </span>
            </div>
            <div className="space-y-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Box Range</span>
                <span className="text-slate-900 font-semibold">{po3.accumulationRange || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Fakeout Level</span>
                <span className="text-rose-700 font-semibold">{fmt(po3.manipulationLevel)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Target Zone</span>
                <span className="text-emerald-700 font-semibold">{fmt(po3.distributionTarget)}</span>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed pt-1">{po3.description}</p>
          </div>
        )}

        {judas && (
          <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold font-display text-slate-900 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-600" />
                Fakeout / Stop-Hunt Watch
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {judas.detected ? "Wick Rejected" : "Clean"}
              </span>
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-slate-500 font-sans">Key Watch Level</span>
              <span className="text-slate-900 font-bold">{fmt(judas.triggerLevel)}</span>
            </div>
            <p className="text-slate-600 leading-relaxed">{judas.description}</p>
          </div>
        )}

        {crt && (
          <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold font-display text-slate-900 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-600" />
                Key Range High / Low
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {String(crt.sweepType || "NONE").replace(/_/g, " ")}
              </span>
            </div>
            <div className="space-y-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">High / Low</span>
                <span className="text-slate-900 font-semibold">
                  {fmt(crt.rangeHigh)} / {fmt(crt.rangeLow)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Direction</span>
                <span className="text-emerald-700 font-semibold">{crt.deliveryDirection || "NEUTRAL"}</span>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed pt-1">{crt.description}</p>
          </div>
        )}
      </div>

      {/* SUPPORT / RESISTANCE ZONES & STEP-BY-STEP TRADE PLAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-300 pb-2">
            Key Support, Resistance &amp; Price Action
          </h3>
          <div className="space-y-2.5">
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Key Entry Zone ({analysis.orderBlock?.type || "Support/Resistance"})</span>
                <span className="font-mono text-emerald-700">{analysis.orderBlock?.priceRange || "—"}</span>
              </div>
              <p className="text-slate-600 mt-1">{analysis.orderBlock?.rationale}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Price Gap / Imbalance</span>
                <span className="font-mono text-slate-800">{analysis.liquidityVoid?.priceRange || "—"}</span>
              </div>
              <p className="text-slate-600 mt-1">{analysis.liquidityVoid?.description}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Candlestick Signal</span>
                <span className="font-mono text-slate-800">{analysis.candlestickPatterns?.patternName || "—"}</span>
              </div>
              <p className="text-slate-600 mt-1">{analysis.candlestickPatterns?.context}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-300 pb-2">
            Pullback Levels &amp; Step-by-Step Trade Plan
          </h3>
          {fib && (
            <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
              <div className="p-2.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">50% Midpoint</span>
                <span className="font-bold text-slate-900">{fmt(fib.level_50)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-300">
                <span className="text-[10px] font-sans text-emerald-800 block">61.8%–70.5% Pullback</span>
                <span className="font-bold text-emerald-700">{fmt(fib.level_705)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">Deep Pullback</span>
                <span className="font-bold text-slate-900">{fmt(fib.level_786)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <div className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>What To Do</span>
              </div>
              <ul className="space-y-1 text-slate-700">
                {(analysis.doActions || []).slice(0, 3).map((item: string, idx: number) => (
                  <li key={idx} className="leading-snug">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-rose-700 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                <span>What To Avoid</span>
              </div>
              <ul className="space-y-1 text-slate-700">
                {(analysis.dontActions || []).slice(0, 3).map((item: string, idx: number) => (
                  <li key={idx} className="leading-snug">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.educationalInsight && (
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300 text-slate-700 flex items-start gap-2">
              <BookOpen className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{analysis.educationalInsight}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
