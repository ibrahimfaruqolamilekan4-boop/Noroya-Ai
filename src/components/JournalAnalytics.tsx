import React, { useMemo, useState } from "react";
import {
  Zap,
  TrendingUp,
  Bell,
  Sparkles,
  CheckCircle2,
  BookmarkPlus,
  Loader2,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { Trade } from "../lib/db";
import { saveUserLearning } from "../lib/firebaseChat";
import { formatPrice } from "../lib/quantEngine";
import { SyntheticSymbol } from "../data/symbols";

interface DebriefResult {
  headline: string;
  whatWorked: string;
  whatToImprove: string;
  suggestedRule: string;
  ruleCategory: string;
}

interface JournalAnalyticsProps {
  trades: Trade[];
  activeSymbol: SyntheticSymbol;
  livePrice: number;
  isSignedIn: boolean;
}

const LOCAL_LEARNINGS_KEY = "synthetic_smc_local_learnings";

export const JournalAnalytics: React.FC<JournalAnalyticsProps> = ({
  trades,
  activeSymbol,
  livePrice,
  isSignedIn,
}) => {
  const [debriefTradeId, setDebriefTradeId] = useState<string | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefResult, setDebriefResult] = useState<DebriefResult | null>(null);
  const [ruleSaved, setRuleSaved] = useState(false);
  const [savingRule, setSavingRule] = useState(false);

  const stats = useMemo(() => {
    const calcBucket = (list: Trade[]) => {
      const settled = list.filter((t) => t.status === "WON" || t.status === "LOST" || t.status === "BREAKEAVEN");
      const wins = list.filter((t) => t.status === "WON").length;
      const losses = list.filter((t) => t.status === "LOST").length;
      const decided = wins + losses;
      const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;
      const netPnl = settled.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
      const avgPnl = settled.length > 0 ? netPnl / settled.length : 0;
      return { total: list.length, wins, losses, winRate, netPnl, avgPnl };
    };

    const scalpList = trades.filter((t) => t.trading_style === "SCALP");
    const normalList = trades.filter((t) => t.trading_style !== "SCALP");

    // Per-symbol breakdown
    const symMap = new Map<string, Trade[]>();
    for (const t of trades) {
      const key = (t.symbol || "UNKNOWN").toUpperCase();
      const arr = symMap.get(key) || [];
      arr.push(t);
      symMap.set(key, arr);
    }

    const bySymbol = Array.from(symMap.entries())
      .map(([sym, list]) => ({ symbol: sym, ...calcBucket(list) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const pendingOnActive = trades.filter(
      (t) =>
        t.status === "PENDING" &&
        (t.symbol.toUpperCase() === activeSymbol.ticker.toUpperCase() ||
          t.symbol.toUpperCase().includes(activeSymbol.ticker.toUpperCase()))
    );

    const recentSettled = trades
      .filter((t) => t.status === "WON" || t.status === "LOST" || t.status === "BREAKEAVEN")
      .slice(0, 4);

    return {
      scalp: calcBucket(scalpList),
      normal: calcBucket(normalList),
      bySymbol,
      pendingOnActive,
      recentSettled,
    };
  }, [trades, activeSymbol.ticker]);

  const handleRunDebrief = async (trade: Trade) => {
    setDebriefTradeId(trade.id);
    setDebriefLoading(true);
    setDebriefResult(null);
    setRuleSaved(false);
    try {
      const res = await fetch("/api/debrief-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade }),
      });
      const json = await res.json();
      if (json?.success && json.data) {
        setDebriefResult(json.data);
      }
    } catch (err) {
      console.error("Trade debrief failed:", err);
    } finally {
      setDebriefLoading(false);
    }
  };

  const handleSaveRule = async (trade: Trade) => {
    if (!debriefResult) return;
    setSavingRule(true);
    try {
      if (isSignedIn) {
        await saveUserLearning(
          debriefResult.suggestedRule,
          trade.symbol || "General",
          debriefResult.ruleCategory || "Entry Timing"
        );
      } else {
        // Free guest mode fallback in localStorage
        const existingRaw = localStorage.getItem(LOCAL_LEARNINGS_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        existing.unshift({
          id: `local_${Date.now()}`,
          learnings: debriefResult.suggestedRule,
          symbol: trade.symbol || "General",
          category: debriefResult.ruleCategory || "Entry Timing",
          created_at: new Date().toISOString(),
        });
        localStorage.setItem(LOCAL_LEARNINGS_KEY, JSON.stringify(existing.slice(0, 30)));
      }
      setRuleSaved(true);
    } catch (err) {
      console.error("Save rule failed:", err);
    } finally {
      setSavingRule(false);
    }
  };

  if (trades.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* 1. LIVE PENDING TRADE PRICE WATCH */}
      {stats.pendingOnActive.length > 0 && livePrice > 0 && (
        <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <Bell className="h-4 w-4 text-emerald-600" />
              <span>
                Live Watch · {stats.pendingOnActive.length} Pending Trade
                {stats.pendingOnActive.length === 1 ? "" : "s"} on {activeSymbol.ticker}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-800 tabular-nums">
              Live Price: {formatPrice(livePrice, activeSymbol)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {stats.pendingOnActive.map((t) => {
              const isBuy = String(t.bias).toUpperCase().includes("BULL") || t.take_profit > t.entry_price;
              const hitTp = isBuy ? livePrice >= t.take_profit : livePrice <= t.take_profit;
              const hitSl = isBuy ? livePrice <= t.stop_loss : livePrice >= t.stop_loss;
              const nearEntry =
                Math.abs(livePrice - t.entry_price) / Math.max(t.entry_price, 0.0001) <= 0.0025;

              return (
                <div
                  key={t.id}
                  className="bg-[#F1F4F8] border border-slate-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-slate-900">
                      {t.symbol} · {t.trading_style === "SCALP" ? "SCALP" : "NORMAL"} ({t.timeframe})
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                      Entry {t.entry_price} · SL {t.stop_loss} · TP {t.take_profit}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
                      hitTp
                        ? "bg-emerald-600 text-white"
                        : hitSl
                        ? "bg-rose-600 text-white"
                        : nearEntry
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-[#E8ECF2] text-slate-700 border border-slate-300"
                    }`}
                  >
                    {hitTp
                      ? "TP1 HIT — Lock Profit!"
                      : hitSl
                      ? "STOP LOSS REACHED"
                      : nearEntry
                      ? "AT ENTRY ZONE"
                      : "TRACKING LIVE"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SCALP VS NORMAL PERFORMANCE COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#F1F4F8] border border-slate-300 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Zap className="h-4 w-4 text-emerald-600" />
              <span>Scalp Setups</span>
            </div>
            <span className="text-[11px] font-mono text-slate-600 tabular-nums">
              {stats.scalp.total} trades
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <div className="bg-[#E8ECF2] rounded-lg p-2.5 border border-slate-300/80">
              <span className="text-[10px] text-slate-500 block">Win Rate</span>
              <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                {stats.scalp.winRate}%
              </span>
            </div>
            <div className="bg-[#E8ECF2] rounded-lg p-2.5 border border-slate-300/80">
              <span className="text-[10px] text-slate-500 block">W / L</span>
              <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                {stats.scalp.wins}W / {stats.scalp.losses}L
              </span>
            </div>
            <div className="bg-[#E8ECF2] rounded-lg p-2.5 border border-slate-300/80">
              <span className="text-[10px] text-slate-500 block">Net P&amp;L</span>
              <span
                className={`font-mono font-bold text-sm tabular-nums ${
                  stats.scalp.netPnl >= 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {stats.scalp.netPnl >= 0 ? "+" : ""}${stats.scalp.netPnl.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#F1F4F8] border border-slate-300 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span>Normal Trades</span>
            </div>
            <span className="text-[11px] font-mono text-slate-600 tabular-nums">
              {stats.normal.total} trades
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <div className="bg-[#E8ECF2] rounded-lg p-2.5 border border-slate-300/80">
              <span className="text-[10px] text-slate-500 block">Win Rate</span>
              <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                {stats.normal.winRate}%
              </span>
            </div>
            <div className="bg-[#E8ECF2] rounded-lg p-2.5 border border-slate-300/80">
              <span className="text-[10px] text-slate-500 block">W / L</span>
              <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                {stats.normal.wins}W / {stats.normal.losses}L
              </span>
            </div>
            <div className="bg-[#E8ECF2] rounded-lg p-2.5 border border-slate-300/80">
              <span className="text-[10px] text-slate-500 block">Net P&amp;L</span>
              <span
                className={`font-mono font-bold text-sm tabular-nums ${
                  stats.normal.netPnl >= 0 ? "text-emerald-700" : "text-rose-600"
                }`}
              >
                {stats.normal.netPnl >= 0 ? "+" : ""}${stats.normal.netPnl.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        {/* 3. TOP SYMBOLS BREAKDOWN */}
        <div className="bg-[#F1F4F8] border border-slate-300 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            <span>Performance by Market</span>
          </div>
          <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
            {stats.bySymbol.map((row) => (
              <div
                key={row.symbol}
                className="flex items-center justify-between text-[11px] font-mono bg-[#E8ECF2] px-2.5 py-1.5 rounded border border-slate-300/80"
              >
                <span className="font-bold text-slate-900">{row.symbol}</span>
                <span className="text-slate-600 tabular-nums">
                  {row.winRate}% ({row.wins}W/{row.losses}L)
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    row.netPnl >= 0 ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {row.netPnl >= 0 ? "+" : ""}${row.netPnl.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. POST-TRADE AI DEBRIEF & AUTO-RULE EXTRACTOR */}
      {stats.recentSettled.length > 0 && (
        <div className="bg-[#F1F4F8] border border-slate-300 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span>AI Post-Trade Debrief &amp; Rule Builder</span>
            </div>
            <span className="text-[11px] text-slate-600">
              Extract a personal rule from any closed trade to teach the AI analyzer
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {stats.recentSettled.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => void handleRunDebrief(t)}
                disabled={debriefLoading && debriefTradeId === t.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                  debriefTradeId === t.id
                    ? "bg-emerald-600 text-white border-emerald-700"
                    : "bg-[#E8ECF2] hover:bg-emerald-50 text-slate-800 border-slate-300 hover:border-emerald-400"
                }`}
              >
                {debriefLoading && debriefTradeId === t.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                <span>
                  Debrief {t.symbol} ({t.status})
                </span>
              </button>
            ))}
          </div>

          {debriefResult && debriefTradeId && (
            <div className="bg-[#E8ECF2] border border-slate-300 rounded-lg p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900 text-sm">{debriefResult.headline}</span>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] text-emerald-800 font-semibold">
                  {debriefResult.ruleCategory}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#F1F4F8] border border-slate-300 rounded-lg p-3">
                  <div className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    What Worked
                  </div>
                  <p className="text-slate-700 leading-relaxed">{debriefResult.whatWorked}</p>
                </div>
                <div className="bg-[#F1F4F8] border border-slate-300 rounded-lg p-3">
                  <div className="text-[11px] font-bold text-amber-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    What To Watch Next Time
                  </div>
                  <p className="text-slate-700 leading-relaxed">{debriefResult.whatToImprove}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-800 block">
                    Suggested Rule For AI Playbook
                  </span>
                  <p className="text-emerald-950 font-medium mt-0.5">
                    &ldquo;{debriefResult.suggestedRule}&rdquo;
                  </p>
                </div>
                <button
                  type="button"
                  disabled={ruleSaved || savingRule}
                  onClick={() => {
                    const target = stats.recentSettled.find((t) => t.id === debriefTradeId);
                    if (target) void handleSaveRule(target);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  <span>
                    {ruleSaved
                      ? "Saved to AI Playbook!"
                      : savingRule
                      ? "Saving..."
                      : "Save Rule to AI"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
