import React from "react";
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
} from "lucide-react";
import { SyntheticSymbol } from "../data/symbols";

interface VisionReportViewProps {
  analysis: any;
  symbol: SyntheticSymbol;
  timeframe: string;
  onSyncLevels?: (levels: { entry: number; stopLoss: number; tp1: number; tp2: number }) => void;
  onDownloadPDF?: () => void;
}

export const VisionReportView: React.FC<VisionReportViewProps> = ({
  analysis,
  symbol,
  timeframe,
  onSyncLevels,
  onDownloadPDF,
}) => {
  if (!analysis) return null;

  const isHybridAi = analysis.engineMode === "HYBRID_AI_VISION";
  const bias = String(analysis.bias || "NEUTRAL").toUpperCase();
  const setupType = String(analysis.tradeSetup?.type || "WAIT").toUpperCase();
  const isBull = bias === "BULLISH";
  const isBear = bias === "BEARISH";

  const mtf = analysis.multiTimeframe || {};
  const d1Text = mtf.htfBias1D || mtf.trend1D || "Evaluating Daily macro liquidity";
  const h4Text = mtf.intermediateStructure4H || mtf.intermediateZone4H || "Evaluating 4H Order Block / FVG";
  const ltfText = mtf.entryPrecision30M || `Execution precision on ${timeframe}`;

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
      {/* TOP VERDICT & ENGINE TRANSPARENCY CARD */}
      <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-300 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                {isHybridAi
                  ? `Hybrid Quant + Vision AI (${analysis.modelUsed || "Gemini 4 Hydrogen"})`
                  : `Deterministic Quant Engine (${analysis.modelUsed || "Live OHLC SMC"})`}
              </span>
              <span className="text-slate-400">·</span>
              <span>
                {symbol.ticker} ({timeframe})
              </span>
              {analysis.alignedModulesCount !== undefined && (
                <>
                  <span className="text-slate-400">·</span>
                  <span>{analysis.alignedModulesCount}/5 Modules Aligned</span>
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
                Institutional Verdict:{" "}
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
                Confluence
              </span>
              <span className="text-lg font-mono font-bold text-emerald-700 tabular-nums">
                {analysis.confluenceScorePct ?? Math.round((Number(analysis.confluenceScore || 3) / 5) * 100)}%
              </span>
            </div>

            {onSyncLevels && analysis.tradeSetup?.entry > 0 && (
              <button
                type="button"
                onClick={() =>
                  onSyncLevels({
                    entry: Number(analysis.tradeSetup.entry),
                    stopLoss: Number(analysis.tradeSetup.stopLoss),
                    tp1: Number(analysis.tradeSetup.takeProfits?.[0] || analysis.tradeSetup.entry),
                    tp2: Number(analysis.tradeSetup.takeProfits?.[1] || analysis.tradeSetup.entry),
                  })
                }
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Sync to Chart &amp; Sizer</span>
              </button>
            )}

            {onDownloadPDF && (
              <button
                type="button"
                onClick={onDownloadPDF}
                className="px-3.5 py-2 rounded-lg bg-[#E8ECF2] hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>PDF Report</span>
              </button>
            )}
          </div>
        </div>

        {analysis.engineNotice && !isHybridAi && (
          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-300 text-xs text-amber-900">
            <strong>Engine Transparency:</strong> {analysis.engineNotice}
          </div>
        )}

        {/* EXECUTION COORDINATES STRIP */}
        {analysis.tradeSetup && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono tabular-nums">
            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-[10px] font-sans uppercase text-slate-500 block font-semibold">
                Signal / Entry
              </span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {setupType} · {fmt(analysis.tradeSetup.entry)}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-rose-50/60 border border-rose-300">
              <span className="text-[10px] font-sans uppercase text-rose-700 block font-semibold">
                Structural SL
              </span>
              <span className="text-sm font-bold text-rose-700 mt-1 block">
                {fmt(analysis.tradeSetup.stopLoss)}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-[10px] font-sans uppercase text-slate-500 block font-semibold">
                TP1 (40% Partial)
              </span>
              <span className="text-sm font-bold text-emerald-700 mt-1 block">
                {fmt(analysis.tradeSetup.takeProfits?.[0])}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-300">
              <span className="text-[10px] font-sans uppercase text-emerald-800 block font-semibold">
                TP2 (Primary)
              </span>
              <span className="text-sm font-bold text-emerald-700 mt-1 block">
                {fmt(analysis.tradeSetup.takeProfits?.[1])}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <span className="text-[10px] font-sans uppercase text-slate-500 block font-semibold">
                TP3 / Risk-Reward
              </span>
              <span className="text-sm font-bold text-slate-900 mt-1 block">
                {fmt(analysis.tradeSetup.takeProfits?.[2])} · {analysis.tradeSetup.riskRewardRatio || "N/A"}
              </span>
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 text-xs text-slate-700 space-y-1.5">
          <div className="font-semibold text-slate-900">Execution Rationale</div>
          <p className="leading-relaxed">{analysis.tradeSetup?.rationale || analysis.detailedVisualDescription}</p>
          {analysis.suggestedRisk && (
            <p className="text-slate-600 pt-1 border-t border-slate-300/80 font-mono">
              Risk Directive: {analysis.suggestedRisk}
            </p>
          )}
        </div>
      </div>

      {/* ANTI-STOP-LOSS SHIELD & ICT SESSION KILLZONES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {antiSl && (
          <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
              <h3 className="text-sm font-bold font-display text-slate-900 flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                Anti-Stop-Loss Hunting Shield
              </h3>
              <span className="text-xs font-mono font-semibold text-slate-700">
                {String(antiSl.dealingRangePosition || "EQUILIBRIUM").replace(/_/g, " ")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs tabular-nums">
              <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">Structural Invalidation</span>
                <span className="text-sm font-bold text-rose-700 mt-0.5 block">
                  {fmt(antiSl.structuralInvalidationPrice)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">ATR / Volatility Buffer</span>
                <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                  +{antiSl.bufferPipsApplied ?? 0} units
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
              ICT Killzone &amp; Silver Bullet Matrix
            </h3>
            <span className="text-xs font-mono font-semibold text-slate-700">
              {kz?.status === "INACTIVE" ? "Standby Window" : "Session Active"}
            </span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Killzone Window</span>
                <span className="font-mono text-emerald-700">{kz?.windowName || "Standard Session"}</span>
              </div>
              <p className="text-slate-600 mt-1">{kz?.details || "Evaluating institutional liquidity hours."}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Silver Bullet FVG Window</span>
                <span className="font-mono text-slate-700">{sb?.windowName || "Inactive"}</span>
              </div>
              <p className="text-slate-600 mt-1">{sb?.details || "Monitor 10:00–11:00 EST / 03:00–04:00 EST."}</p>
            </div>
          </div>
        </div>
      </div>

      {/* MULTI-TIMEFRAME TOP-DOWN ALIGNMENT (FIXED SCHEMA KEYS) */}
      <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-300 pb-2.5">
          <h3 className="text-sm font-bold font-display text-slate-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            Top-Down Multi-Timeframe Structure (1D → 4H → {timeframe})
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">1D Macro Bias</span>
            <p className="text-slate-800 font-medium leading-relaxed">{d1Text}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">4H Intermediate Structure</span>
            <p className="text-slate-800 font-medium leading-relaxed">{h4Text}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-[#E8ECF2] border border-slate-300 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">{timeframe} Execution Entry</span>
            <p className="text-slate-800 font-medium leading-relaxed">{ltfText}</p>
          </div>
        </div>
        {mtf.confirmationMessage && (
          <p className="text-xs text-slate-600 font-mono">{mtf.confirmationMessage}</p>
        )}
      </div>

      {/* POWER OF 3 (AMD), JUDAS SWING & CANDLE RANGE THEORY (PREVIOUSLY HIDDEN CARDS!) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {po3 && (
          <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-300 pb-2">
              <span className="font-bold font-display text-slate-900 flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-emerald-600" />
                Power of 3 (AMD)
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {po3.detected ? "Active" : "Forming"}
              </span>
            </div>
            <div className="space-y-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Accumulation</span>
                <span className="text-slate-900 font-semibold">{po3.accumulationRange || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Manipulation</span>
                <span className="text-rose-700 font-semibold">{fmt(po3.manipulationLevel)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Distribution TP</span>
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
                Judas Swing Trap
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {judas.detected ? `${judas.direction} Sweep` : "None"}
              </span>
            </div>
            <div className="flex justify-between font-mono tabular-nums">
              <span className="text-slate-500 font-sans">Sweep Trigger</span>
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
                Candle Range Theory (CRT)
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {String(crt.sweepType || "NONE").replace(/_/g, " ")}
              </span>
            </div>
            <div className="space-y-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Range High / Low</span>
                <span className="text-slate-900 font-semibold">
                  {fmt(crt.rangeHigh)} / {fmt(crt.rangeLow)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Delivery Bias</span>
                <span className="text-emerald-700 font-semibold">{crt.deliveryDirection || "NEUTRAL"}</span>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed pt-1">{crt.description}</p>
          </div>
        )}
      </div>

      {/* INSTITUTIONAL PD ARRAYS & FIBONACCI MATRIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-300 pb-2">
            Institutional Zones &amp; Imbalances
          </h3>
          <div className="space-y-2.5">
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Order Block ({analysis.orderBlock?.type || "POI"})</span>
                <span className="font-mono text-emerald-700">{analysis.orderBlock?.priceRange || "—"}</span>
              </div>
              <p className="text-slate-600 mt-1">{analysis.orderBlock?.rationale}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Fair Value Gap / Liquidity Void</span>
                <span className="font-mono text-slate-800">{analysis.liquidityVoid?.priceRange || "—"}</span>
              </div>
              <p className="text-slate-600 mt-1">{analysis.liquidityVoid?.description}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#E8ECF2] border border-slate-300">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Candlestick Trigger</span>
                <span className="font-mono text-slate-800">{analysis.candlestickPatterns?.patternName || "—"}</span>
              </div>
              <p className="text-slate-600 mt-1">{analysis.candlestickPatterns?.context}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[#F1F4F8] border border-slate-300 p-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold font-display text-slate-900 border-b border-slate-300 pb-2">
            Fibonacci OTE &amp; Execution Rules
          </h3>
          {fib && (
            <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
              <div className="p-2.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">0.50 EQ</span>
                <span className="font-bold text-slate-900">{fmt(fib.level_50)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-300">
                <span className="text-[10px] font-sans text-emerald-800 block">0.705 OTE</span>
                <span className="font-bold text-emerald-700">{fmt(fib.level_705)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#E8ECF2] border border-slate-300">
                <span className="text-[10px] font-sans text-slate-500 block">0.786 Deep</span>
                <span className="font-bold text-slate-900">{fmt(fib.level_786)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <div className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Mechanical Do&apos;s</span>
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
                <span>Invalidation Don&apos;ts</span>
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
