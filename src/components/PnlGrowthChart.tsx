import React, { useState, useEffect } from "react";
import { Trade } from "../lib/db";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Award, Flame, Zap, ArrowUpRight, ArrowDownRight, RefreshCcw } from "lucide-react";

interface PnlGrowthChartProps {
  trades: Trade[];
}

function AnimatedStat({ value, formatter }: { value: number; formatter: (val: number) => React.ReactNode }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 900;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress * (2 - progress);
      setDisplayValue(easeProgress * value);
      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };
    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [value]);

  return <>{formatter(displayValue)}</>;
}

export default function PnlGrowthChart({ trades }: PnlGrowthChartProps) {
  const closedTrades = [...trades]
    .filter((t) => t.status !== "PENDING")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (closedTrades.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3" id="pnl-chart-empty">
        <div className="mx-auto w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h4 className="text-sm font-bold text-slate-900 font-display">
            Cumulative Equity Curve Pending
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your realized profit and loss growth curve will render automatically once you settle outcomes for closed positions in the table below.
          </p>
        </div>
      </div>
    );
  }

  let runningPnl = 0;
  let maxPnl = 0;
  let maxDrawdown = 0;
  let winStreak = 0;
  let currentWinStreak = 0;
  let consecutiveLosses = 0;
  let maxConsecutiveLosses = 0;

  const chartData = closedTrades.map((t, index) => {
    const tradePnl = t.pnl || 0;
    runningPnl += tradePnl;

    if (runningPnl > maxPnl) {
      maxPnl = runningPnl;
    }
    const currentDrawdown = maxPnl - runningPnl;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }

    if (t.status === "WON") {
      currentWinStreak++;
      consecutiveLosses = 0;
      if (currentWinStreak > winStreak) {
        winStreak = currentWinStreak;
      }
    } else if (t.status === "LOST") {
      consecutiveLosses++;
      currentWinStreak = 0;
      if (consecutiveLosses > maxConsecutiveLosses) {
        maxConsecutiveLosses = consecutiveLosses;
      }
    } else {
      currentWinStreak = 0;
      consecutiveLosses = 0;
    }

    const dateObj = new Date(t.created_at);
    const formattedDate = dateObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return {
      index: index + 1,
      date: formattedDate,
      rawDate: t.created_at,
      pnl: tradePnl,
      cumulativePnl: Number(runningPnl.toFixed(2)),
      symbol: t.symbol,
      bias: t.bias,
      status: t.status,
    };
  });

  const initialPoint = {
    index: 0,
    date: "Initial",
    rawDate: "",
    pnl: 0,
    cumulativePnl: 0,
    symbol: "START",
    bias: "NONE",
    status: "NONE",
  };

  const chartSourceData = [initialPoint, ...chartData];
  const bestTrade = Math.max(...closedTrades.map((t) => t.pnl || 0), 0);
  const worstTrade = Math.min(...closedTrades.map((t) => t.pnl || 0), 0);
  const totalGain = runningPnl;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.index === 0) {
        return (
          <div className="bg-white border border-slate-200 p-2.5 rounded-lg shadow-md text-xs text-slate-600 font-mono">
            Ledger Baseline ($0.00)
          </div>
        );
      }
      const isProfit = data.cumulativePnl >= 0;
      const isTradeProfit = data.pnl >= 0;

      return (
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg text-xs space-y-1.5 min-w-[200px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1">
            <span className="text-[11px] text-slate-500 font-mono">Trade #{data.index}</span>
            <span className="text-[11px] text-slate-500 font-mono">{data.date}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Symbol:</span>
            <span className="font-mono font-bold text-slate-900">{data.symbol}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Realized P&amp;L:</span>
            <span className={`font-mono font-bold ${isTradeProfit ? "text-emerald-700" : "text-rose-600"}`}>
              {isTradeProfit ? "+" : ""}{data.pnl.toFixed(2)} USD
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-1">
            <span className="text-slate-900 font-semibold">Cumulative P&amp;L:</span>
            <span className={`font-mono font-bold ${isProfit ? "text-emerald-700" : "text-rose-600"}`}>
              {isProfit ? "+" : ""}{data.cumulativePnl.toFixed(2)} USD
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="pnl-growth-visualization">
      {/* Chart container column */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="text-xs font-mono text-emerald-700">Realized Ledger Telemetry</div>
            <h3 className="text-base font-bold text-slate-900 font-display">
              Cumulative Equity Curve (USD)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-600">
            {closedTrades.length} Settled Positions
          </span>
        </div>

        <div className="w-full h-64 md:h-72" id="recharts-equity-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartSourceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={totalGain >= 0 ? "#059669" : "#E11D48"}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="95%"
                    stopColor={totalGain >= 0 ? "#059669" : "#E11D48"}
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="index"
                stroke="#64748B"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val >= 0 ? "+" : ""}$${val}`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "#94A3B8", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1} strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={totalGain >= 0 ? "#059669" : "#E11D48"}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#pnlGradient)"
                activeDot={{ r: 5, strokeWidth: 0, fill: totalGain >= 0 ? "#059669" : "#E11D48" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analytic Statistics Column */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <div className="text-xs font-mono text-emerald-700">Risk Metrics</div>
          <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-1.5">
            <Award className="h-4 w-4 text-emerald-600" />
            Performance Breakdown
          </h3>
        </div>

        <div className="space-y-3 my-auto">
          <div className="bg-[#F8FAF9] p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-slate-700 font-medium">Best Single Trade</span>
            </div>
            <span className="text-xs font-bold font-mono text-emerald-700 tabular-nums">
              <AnimatedStat value={bestTrade} formatter={(val) => `+$${val.toFixed(2)}`} />
            </span>
          </div>

          <div className="bg-[#F8FAF9] p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
              <span className="text-xs text-slate-700 font-medium">Largest Drawdown Hit</span>
            </div>
            <span className="text-xs font-bold font-mono text-rose-600 tabular-nums">
              <AnimatedStat
                value={worstTrade}
                formatter={(val) => `${val < 0 ? "" : "-"}$${Math.abs(val).toFixed(2)}`}
              />
            </span>
          </div>

          <div className="bg-[#F8FAF9] p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-slate-700 font-medium">Max Win Streak</span>
            </div>
            <span className="text-xs font-bold font-mono text-slate-900 tabular-nums">
              <AnimatedStat value={winStreak} formatter={(val) => `${val.toFixed(0)} Trades`} />
            </span>
          </div>

          <div className="bg-[#F8FAF9] p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-slate-700 font-medium">Max Loss Streak</span>
            </div>
            <span className="text-xs font-bold font-mono text-slate-900 tabular-nums">
              <AnimatedStat
                value={maxConsecutiveLosses}
                formatter={(val) => `${val.toFixed(0)} Trades`}
              />
            </span>
          </div>

          <div className="bg-[#F8FAF9] p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-rose-600" />
              <span className="text-xs text-slate-700 font-medium">Peak Equity Drawdown</span>
            </div>
            <span className="text-xs font-bold font-mono text-rose-600 tabular-nums">
              <AnimatedStat value={maxDrawdown} formatter={(val) => `-$${val.toFixed(2)}`} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
