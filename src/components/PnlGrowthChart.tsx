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
  ReferenceLine
} from "recharts";
import { TrendingUp, Award, Flame, Zap, ArrowUpRight, ArrowDownRight, RefreshCcw } from "lucide-react";
import { motion } from "motion/react";

interface PnlGrowthChartProps {
  trades: Trade[];
}

const containerVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
      staggerChildren: 0.1
    }
  }
};

const childVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

function AnimatedStat({ value, formatter }: { value: number; formatter: (val: number) => React.ReactNode }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const duration = 1200; // 1.2s

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = progress * (2 - progress); // easeOutQuad
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
  // Settle only closed trades (WON, LOST, BREAKEAVEN)
  const closedTrades = [...trades]
    .filter((t) => t.status !== "PENDING")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Handle empty or too few trades gracefully
  if (closedTrades.length === 0) {
    return (
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-8 text-center space-y-4 max-w-full" id="pnl-chart-empty">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse">
          <TrendingUp className="h-6 w-6 text-slate-500" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h4 className="text-sm font-bold text-white font-display uppercase tracking-widest">Growth Curve Pending</h4>
          <p className="text-xs text-slate-400 leading-normal">
            Your cumulative profit and loss growth curve will dynamically render here once you settle outcomes for closed trades. 
          </p>
        </div>
        <div className="p-3 bg-slate-900/60 rounded-xl max-w-xs mx-auto border border-slate-850/60 text-[10px] text-slate-500 font-mono">
          Tip: Click table rows below and use the "Outcome Settlement & P&L" tool to commit exit prices.
        </div>
      </div>
    );
  }

  // Calculate cumulative stats step-by-step
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

    // Track Peak and Drawdowns
    if (runningPnl > maxPnl) {
      maxPnl = runningPnl;
    }
    const currentDrawdown = maxPnl - runningPnl;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
    }

    // Streaks
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
      // Breakeaven doesn't break/increment streaks by design in some risk paradigms, but let's reset here
      currentWinStreak = 0;
      consecutiveLosses = 0;
    }

    const dateObj = new Date(t.created_at);
    const formattedDate = dateObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    return {
      index: index + 1,
      date: formattedDate,
      rawDate: t.created_at,
      pnl: tradePnl,
      cumulativePnl: Number(runningPnl.toFixed(2)),
      symbol: t.symbol,
      bias: t.bias,
      status: t.status
    };
  });

  // Base starting seed point at (x=0, y=0)
  const initialPoint = {
    index: 0,
    date: "Zero State",
    rawDate: "",
    pnl: 0,
    cumulativePnl: 0,
    symbol: "START",
    bias: "NONE",
    status: "NONE"
  };

  const chartSourceData = [initialPoint, ...chartData];

  // Helper Stats derivation
  const bestTrade = Math.max(...closedTrades.map((t) => t.pnl || 0), 0);
  const worstTrade = Math.min(...closedTrades.map((t) => t.pnl || 0), 0);
  const totalGain = runningPnl;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.index === 0) {
        return (
          <div className="bg-slate-950/95 border border-slate-800 p-2.5 rounded-lg shadow-2xl font-sans text-[11px] text-slate-500 font-mono">
            Journal Seed Point ($0.00 Base)
          </div>
        );
      }
      const isProfit = data.cumulativePnl >= 0;
      const isTradeProfit = data.pnl >= 0;

      return (
        <div className="bg-slate-950/95 border border-slate-850 p-3 rounded-xl shadow-2xl font-sans text-xs space-y-2 backdrop-blur-sm min-w-[200px]" id="recharts-custom-tooltip">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 mb-1">
            <span className="text-[10px] text-slate-500 font-mono">Settle #{data.index}</span>
            <span className="text-[10px] text-slate-400 font-mono leading-none">{data.date}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 font-medium text-[11px]">Symbol:</span>
            <span className="font-mono font-bold text-white uppercase text-[11px]">{data.symbol}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 font-medium text-[11px]">Bias:</span>
            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
              data.bias === 'BULLISH' || data.bias === 'BUY' || data.bias === 'LONG' || data.bias === 'CALL'
                ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30'
                : 'bg-rose-950/30 text-rose-400 border border-rose-900/30'
            }`}>
              {data.bias}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 font-medium text-[11px]">Result:</span>
            <span className={`font-bold text-[11px] ${data.status === 'WON' ? 'text-emerald-400' : data.status === 'LOST' ? 'text-rose-400' : 'text-slate-400'}`}>
              {data.status}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-slate-800/40 pt-1.5 mt-1">
            <span className="text-slate-400 font-medium text-[11px]">Trade P&L:</span>
            <span className={`font-mono font-bold text-[11px] ${isTradeProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTradeProfit ? '+' : ''}{data.pnl.toFixed(2)} USD
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-slate-800/80 pt-1.5">
            <span className="text-slate-100 font-semibold text-[11px]">Account Equity P&L:</span>
            <span className={`font-mono font-black text-xs ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfit ? '+' : ''}{data.cumulativePnl.toFixed(2)} USD
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div 
      className="grid grid-cols-1 lg:grid-cols-4 gap-6" 
      id="pnl-growth-visualization"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      
      {/* Chart container column */}
      <motion.div 
        className="lg:col-span-3 bg-[#111827] border border-slate-800 rounded-2xl p-4 md:p-5 flex flex-col justify-between space-y-4"
        variants={childVariants}
      >
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-950/40 p-1.5 rounded-lg border border-indigo-900/30">
                <TrendingUp className="h-4 w-4 text-indigo-400 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">
                Cumulative Equity Curve (P&L USD)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-1 rounded">
              {closedTrades.length} Trades Settled
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Real-time equity sequence mapping net performance across custom synthetic assets.
          </p>
        </div>

        {/* The Recharts Area Canvas */}
        <div className="w-full h-64 md:h-72 mt-2" id="recharts-equity-canvas">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartSourceData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={totalGain >= 0 ? "#10b981" : "#f43f5e"} 
                    stopOpacity={0.25} 
                  />
                  <stop 
                    offset="95%" 
                    stopColor={totalGain >= 0 ? "#10b981" : "#f43f5e"} 
                    stopOpacity={0.0} 
                  />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#1e293b" 
                opacity={0.3} 
                vertical={false}
              />
              <XAxis
                dataKey="index"
                stroke="#475569"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#475569"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val >= 0 ? "+" : ""}$${val}`}
              />
              <Tooltip 
                content={<CustomTooltip />} 
                cursor={{ stroke: '#334155', strokeWidth: 1, strokeDasharray: '4 4' }} 
              />
              <ReferenceLine 
                y={0} 
                stroke="#475569" 
                strokeWidth={1.5} 
                strokeDasharray="3 3" 
                opacity={0.5} 
              />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={totalGain >= 0 ? "#10b981" : "#f43f5e"}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#pnlGradient)"
                activeDot={{ r: 6, strokeWidth: 0, fill: totalGain >= 0 ? "#10b981" : "#f43f5e" }}
                isAnimationActive={true}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Info Line */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono border-t border-slate-900/60 pt-3">
          <span>X: Settled Trade Sequence Index</span>
          <span>Y: Balance Margin Delta ($ USD)</span>
        </div>
      </motion.div>

      {/* Advanced Analytic Statistics Cards column */}
      <motion.div 
        className="bg-[#111827] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 font-sans"
        variants={childVariants}
      >
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-widest font-display flex items-center gap-1.5">
            <Award className="h-4 w-4 text-amber-500" />
            Performance Insights
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-normal">
            Calculated key risk and statistics from closed ledger trade events.
          </p>
        </div>

        <div className="space-y-3.5 my-auto">
          {/* Best Trade */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-[10.5px] text-slate-400 font-medium">Single Best Run</span>
            </div>
            <span className="text-xs font-bold font-mono text-emerald-400">
              <AnimatedStat 
                value={bestTrade} 
                formatter={(val) => `+$${val.toFixed(2)}`}
              />
            </span>
          </div>

          {/* Worst Trade */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-rose-500/10 border border-rose-500/20">
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <span className="text-[10.5px] text-slate-400 font-medium">Deepest Hit</span>
            </div>
            <span className="text-xs font-bold font-mono text-rose-400">
              <AnimatedStat 
                value={worstTrade} 
                formatter={(val) => `${val < 0 ? "" : "-"}$${Math.abs(val).toFixed(2)}`}
              />
            </span>
          </div>

          {/* Max Win Streak */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20">
                <Flame className="h-3.5 w-3.5 text-indigo-400 animate-bounce" />
              </div>
              <span className="text-[10.5px] text-slate-400 font-medium">Max Win Streak</span>
            </div>
            <span className="text-xs font-bold font-mono text-white">
              <AnimatedStat 
                value={winStreak} 
                formatter={(val) => `${val.toFixed(0)} Trades`}
              />
            </span>
          </div>

          {/* Max consecutive losses */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
              </div>
              <span className="text-[10.5px] text-slate-400 font-medium">Max Loss Streak</span>
            </div>
            <span className="text-xs font-bold font-mono text-slate-300">
              <AnimatedStat 
                value={maxConsecutiveLosses} 
                formatter={(val) => `${val.toFixed(0)} Trades`}
              />
            </span>
          </div>

          {/* Max peak Drawdown */}
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-red-500/10 border border-red-500/20">
                <RefreshCcw className="h-3.5 w-3.5 text-red-400" />
              </div>
              <span className="text-[10.5px] text-slate-400 font-medium">Max Peak Drawdown</span>
            </div>
            <span className="text-xs font-bold font-mono text-rose-500">
              <AnimatedStat 
                value={maxDrawdown} 
                formatter={(val) => `-$${val.toFixed(2)}`}
              />
            </span>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 italic leading-relaxed text-center border-t border-slate-900/60 pt-3">
          Maintain disciplines, respect the Market Structure shift (MSS) sweeps, and let probabilities run!
        </div>
      </motion.div>

    </motion.div>
  );
}
