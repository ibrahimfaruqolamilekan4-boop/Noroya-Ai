import React, { useEffect, useRef, useState, useMemo } from "react";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import {
  Activity,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  TrendingDown,
  TrendingUp,
  Sliders,
  Moon,
  Sun,
  Layers,
  Crosshair,
  Camera,
} from "lucide-react";
import { SyntheticSymbol } from "../data/symbols";
import { useMarketData } from "../hooks/useMarketData";
import { formatPrice, QuantitativeEvaluation } from "../lib/quantEngine";

interface LiveTradingViewChartProps {
  symbol: SyntheticSymbol;
  timeframe?: string;
  analysisResult?: any;
  quantEvaluation?: QuantitativeEvaluation | null;
  currentWorkspaceLevels?: { entry: number; stopLoss: number; tp1: number; tp2: number };
  onSyncLevels?: (levels: { entry: number; stopLoss: number; tp1: number; tp2: number }) => void;
  onCaptureScreenshot?: (dataUrl: string) => void;
  onDivergencesDetected?: (divs: DivergenceInfo[]) => void;
}

export interface DivergenceInfo {
  type: "BULLISH" | "BEARISH";
  time1: any;
  time2: any;
  valPrice1: number;
  valPrice2: number;
  valRsi1: number;
  valRsi2: number;
}

// Technical analysis helper to calculate RSI (period = 14)
export function calculateRSI(data: any[], period: number = 14): { time: any; value: number }[] {
  if (data.length <= period) return [];

  const rsiList: { time: any; value: number }[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  rsiList.push({ time: data[period].time, value: rsi });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    rsiList.push({ time: data[i].time, value: rsi });
  }

  return rsiList;
}

// Detect RSI Divergences
export function detectRsiDivergences(candles: any[], rsiList: { time: any; value: number }[]): DivergenceInfo[] {
  if (candles.length < 10 || rsiList.length < 10) return [];

  const swingLows: any[] = [];
  const swingHighs: any[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const isLow =
      candles[i].low <= candles[i - 1].low &&
      candles[i].low <= candles[i - 2].low &&
      candles[i].low < candles[i + 1].low &&
      candles[i].low < candles[i + 2].low;

    const isHigh =
      candles[i].high >= candles[i - 1].high &&
      candles[i].high >= candles[i - 2].high &&
      candles[i].high > candles[i + 1].high &&
      candles[i].high > candles[i + 2].high;

    if (isLow) {
      const rsiPoint = rsiList.find((r) => r.time === candles[i].time);
      if (rsiPoint) {
        swingLows.push({ idx: i, time: candles[i].time, low: candles[i].low, rsi: rsiPoint.value });
      }
    }

    if (isHigh) {
      const rsiPoint = rsiList.find((r) => r.time === candles[i].time);
      if (rsiPoint) {
        swingHighs.push({ idx: i, time: candles[i].time, high: candles[i].high, rsi: rsiPoint.value });
      }
    }
  }

  const divergences: DivergenceInfo[] = [];

  for (let i = 1; i < swingLows.length; i++) {
    const older = swingLows[i - 1];
    const newer = swingLows[i];
    const dist = newer.idx - older.idx;

    if (dist >= 5 && dist <= 40 && newer.low < older.low && newer.rsi > older.rsi) {
      divergences.push({
        type: "BULLISH",
        time1: older.time,
        time2: newer.time,
        valPrice1: older.low,
        valPrice2: newer.low,
        valRsi1: older.rsi,
        valRsi2: newer.rsi,
      });
    }
  }

  for (let i = 1; i < swingHighs.length; i++) {
    const older = swingHighs[i - 1];
    const newer = swingHighs[i];
    const dist = newer.idx - older.idx;

    if (dist >= 5 && dist <= 40 && newer.high > older.high && newer.rsi < older.rsi) {
      divergences.push({
        type: "BEARISH",
        time1: older.time,
        time2: newer.time,
        valPrice1: older.high,
        valPrice2: newer.high,
        valRsi1: older.rsi,
        valRsi2: newer.rsi,
      });
    }
  }

  return divergences;
}

export default function LiveTradingViewChart({
  symbol,
  timeframe = "H1",
  analysisResult,
  quantEvaluation,
  currentWorkspaceLevels,
  onSyncLevels,
  onCaptureScreenshot,
  onDivergencesDetected,
}: LiveTradingViewChartProps) {
  // Shared live stream from MarketDataContext (no duplicate WebSocket!)
  const { candles, latestCandle, futuresTelemetry, telemetry, isLoading } = useMarketData(symbol, timeframe);

  // Layout Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);

  // Overlay & Chart Theme Toggles
  const [showSmcZones, setShowSmcZones] = useState<boolean>(true);
  const [showLiquidityPools, setShowLiquidityPools] = useState<boolean>(true);
  const [showFibOte, setShowFibOte] = useState<boolean>(true);
  const [showExecutionLines, setShowExecutionLines] = useState<boolean>(true);
  const [showRsi, setShowRsi] = useState<boolean>(true);
  const [darkChart, setDarkChart] = useState<boolean>(false);
  const [divergences, setDivergences] = useState<DivergenceInfo[]>([]);

  // Manual interactive levels
  const [tempEntry, setTempEntry] = useState<number>(0);
  const [tempSL, setTempSL] = useState<number>(0);
  const [tempTP1, setTempTP1] = useState<number>(0);
  const [tempTP2, setTempTP2] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<boolean>(false);

  // Sync levels with workspace / AI result / quantEngine
  useEffect(() => {
    if (currentWorkspaceLevels && currentWorkspaceLevels.entry > 0) {
      setTempEntry(currentWorkspaceLevels.entry);
      setTempSL(currentWorkspaceLevels.stopLoss);
      setTempTP1(currentWorkspaceLevels.tp1);
      setTempTP2(currentWorkspaceLevels.tp2);
    } else if (analysisResult?.tradeSetup?.entry > 0) {
      const ts = analysisResult.tradeSetup;
      const base = Number(ts.entry);
      setTempEntry(base);
      setTempSL(Number(ts.stopLoss) || base * 0.99);
      if (Array.isArray(ts.takeProfits)) {
        setTempTP1(Number(ts.takeProfits[0]) || base * 1.015);
        setTempTP2(Number(ts.takeProfits[1]) || base * 1.03);
      }
    } else if (quantEvaluation?.executionCard?.optimalEntry705 > 0) {
      const ec = quantEvaluation.executionCard;
      setTempEntry(ec.optimalEntry705);
      setTempSL(ec.invalidationSL);
      setTempTP1(ec.tp1_1272);
      setTempTP2(ec.tp2_1618);
    } else {
      const base = latestCandle?.close || symbol.defaultPrice;
      setTempEntry(base);
      setTempSL(base * 0.99);
      setTempTP1(base * 1.015);
      setTempTP2(base * 1.03);
    }
  }, [analysisResult, currentWorkspaceLevels, quantEvaluation?.executionCard?.optimalEntry705, symbol.ticker]);

  // Initialize Lightweight Charts Instance
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {}
      chartRef.current = null;
    }
    if (rsiChartRef.current) {
      try {
        rsiChartRef.current.remove();
      } catch {}
      rsiChartRef.current = null;
    }

    const container = chartContainerRef.current;

    // Comfortable Slate-Gray workstation canvas by default, or Institutional Dark Slate when toggled
    const chartBg = darkChart ? "#0F172A" : "#F1F4F8";
    const chartText = darkChart ? "#CBD5E1" : "#334155";
    const gridColor = darkChart ? "rgba(51, 65, 85, 0.45)" : "rgba(148, 163, 184, 0.28)";
    const borderColor = darkChart ? "rgba(71, 85, 105, 0.6)" : "rgba(148, 163, 184, 0.45)";
    const rsiBg = darkChart ? "#111C33" : "#E8ECF2";

    const chart: any = createChart(container, {
      width: container.clientWidth,
      height: 430,
      layout: {
        background: { color: chartBg },
        textColor: chartText,
        fontFamily: "JetBrains Mono, monospace, sans-serif",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      rightPriceScale: {
        borderColor,
        visible: true,
        scaleMargins: { top: 0.14, bottom: 0.14 },
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#059669",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#059669",
      wickDownColor: "#dc2626",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    let rsiChart: any = null;
    let rsiSeries: any = null;

    if (showRsi && rsiContainerRef.current) {
      rsiChart = createChart(rsiContainerRef.current, {
        width: rsiContainerRef.current.clientWidth,
        height: 125,
        layout: {
          background: { color: rsiBg },
          textColor: chartText,
          fontFamily: "JetBrains Mono, monospace, sans-serif",
        },
        grid: {
          vertLines: { color: gridColor },
          horzLines: { color: gridColor },
        },
        rightPriceScale: {
          borderColor,
          visible: true,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor,
          visible: false,
          timeVisible: true,
        },
      });

      rsiSeries = rsiChart.addSeries(LineSeries, {
        color: "#059669",
        lineWidth: 2,
        priceScaleId: "right",
      });

      rsiSeries.createPriceLine({
        price: 70,
        color: "rgba(220, 38, 38, 0.45)",
        lineWidth: 1,
        lineStyle: 1,
        title: "OB 70",
      });
      rsiSeries.createPriceLine({
        price: 50,
        color: "rgba(100, 116, 139, 0.35)",
        lineWidth: 1,
        lineStyle: 2,
        title: "MID 50",
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: "rgba(5, 150, 105, 0.45)",
        lineWidth: 1,
        lineStyle: 1,
        title: "OS 30",
      });

      rsiChartRef.current = rsiChart;
      rsiSeriesRef.current = rsiSeries;

      const s1 = chart.timeScale();
      const s2 = rsiChart.timeScale();
      let syncing = false;
      s1.subscribeVisibleTimeRangeChange((range: any) => {
        if (syncing || !range) return;
        syncing = true;
        try {
          s2.setVisibleRange(range);
        } catch {}
        syncing = false;
      });
      s2.subscribeVisibleTimeRangeChange((range: any) => {
        if (syncing || !range) return;
        syncing = true;
        try {
          s1.setVisibleRange(range);
        } catch {}
        syncing = false;
      });
    }

    const handleResize = () => {
      if (chart && container) {
        chart.applyOptions({ width: container.clientWidth });
      }
      if (rsiChart && rsiContainerRef.current) {
        rsiChart.applyOptions({ width: rsiContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      try {
        chart.remove();
      } catch {}
      if (rsiChart) {
        try {
          rsiChart.remove();
        } catch {}
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [symbol.ticker, timeframe, showRsi, darkChart]);

  // Populate historical candles & compute RSI divergences
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const formatted = candles.map((c) => ({
      time: c.timestamp as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(formatted);

    const rsiData = calculateRSI(formatted, 14);
    if (rsiSeriesRef.current && rsiData.length > 0) {
      rsiSeriesRef.current.setData(rsiData);
    }

    const divs = detectRsiDivergences(formatted, rsiData);
    setDivergences(divs);
    onDivergencesDetected?.(divs);

    redrawOverlays();
  }, [candles, darkChart]);

  // Update live candle on every intra-candle tick
  useEffect(() => {
    if (!candleSeriesRef.current || !latestCandle) return;
    try {
      candleSeriesRef.current.update({
        time: latestCandle.timestamp as any,
        open: latestCandle.open,
        high: latestCandle.high,
        low: latestCandle.low,
        close: latestCandle.close,
      });
    } catch {}
  }, [latestCandle]);

  const clearPriceLines = () => {
    if (!candleSeriesRef.current) return;
    priceLinesRef.current.forEach((l) => {
      try {
        candleSeriesRef.current.removePriceLine(l);
      } catch {}
    });
    priceLinesRef.current = [];
  };

  // Draw real mathematical SMC Overlays (Order Blocks, FVGs, Liquidity Pools, 0.705 OTE, Execution Levels)
  const redrawOverlays = () => {
    if (!candleSeriesRef.current) return;
    clearPriceLines();

    const addLine = (opts: any) => {
      if (!Number.isFinite(opts.price) || opts.price <= 0) return;
      try {
        const line = candleSeriesRef.current.createPriceLine(opts);
        priceLinesRef.current.push(line);
      } catch {}
    };

    // 1. Order Block & Fair Value Gap Overlays from real quantEngine
    if (showSmcZones && quantEvaluation?.overlays) {
      const topOb = quantEvaluation.overlays.orderBlocks[quantEvaluation.overlays.orderBlocks.length - 1];
      if (topOb) {
        const isBullOb = topOb.type.includes("BULLISH");
        const obColor = isBullOb ? "#0284c7" : "#d97706";
        const label = topOb.type.includes("BREAKER")
          ? isBullOb
            ? "BULL BREAKER"
            : "BEAR BREAKER"
          : isBullOb
          ? "BULL OB"
          : "BEAR OB";

        addLine({
          price: topOb.top,
          color: obColor,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `${label} HIGH`,
        });
        addLine({
          price: topOb.bottom,
          color: obColor,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: `${label} LOW`,
        });
      }

      const openFvg = quantEvaluation.overlays.fairValueGaps[quantEvaluation.overlays.fairValueGaps.length - 1];
      if (openFvg) {
        const fvgColor = openFvg.type === "BULLISH" ? "#0d9488" : "#e11d48";
        addLine({
          price: openFvg.midpointCE,
          color: fvgColor,
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: `${openFvg.type === "BULLISH" ? "BISI" : "SIBI"} FVG 50% CE`,
        });
      }
    }

    // 2. Liquidity Pools (PDH/PDL, EQH/EQL, Asian High/Low)
    if (showLiquidityPools && quantEvaluation?.smcStructure) {
      const s = quantEvaluation.smcStructure;
      if (s.pdh) {
        addLine({
          price: s.pdh,
          color: "#6366f1",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "PDH (BSL)",
        });
      }
      if (s.pdl) {
        addLine({
          price: s.pdl,
          color: "#6366f1",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "PDL (SSL)",
        });
      }
      if (s.asianHigh) {
        addLine({
          price: s.asianHigh,
          color: "#64748b",
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: false,
          title: "ASIAN HIGH",
        });
      }
      if (s.asianLow) {
        addLine({
          price: s.asianLow,
          color: "#64748b",
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: false,
          title: "ASIAN LOW",
        });
      }
    }

    // 3. Fibonacci 0.50 Equilibrium & 0.705 OTE Sweet Spot
    if (showFibOte && quantEvaluation?.fibonacci) {
      addLine({
        price: quantEvaluation.fibonacci.equilibrium50,
        color: "#64748b",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "0.50 EQ",
      });
      addLine({
        price: quantEvaluation.fibonacci.ote705SweetSpot,
        color: "#059669",
        lineWidth: 1,
        lineStyle: 3,
        axisLabelVisible: true,
        title: "0.705 OTE",
      });
    }

    // 4. Trade Execution Coordinates (Entry / SL / TP1 / TP2)
    if (showExecutionLines) {
      if (tempEntry > 0) {
        addLine({
          price: tempEntry,
          color: "#059669",
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: "ENTRY",
        });
      }
      if (tempSL > 0) {
        addLine({
          price: tempSL,
          color: "#dc2626",
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: "SL INVALIDATION",
        });
      }
      if (tempTP1 > 0) {
        addLine({
          price: tempTP1,
          color: "#047857",
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: "TP1 (1.272)",
        });
      }
      if (tempTP2 > 0) {
        addLine({
          price: tempTP2,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: "TP2 (1.618)",
        });
      }
    }
  };

  useEffect(() => {
    redrawOverlays();
  }, [
    tempEntry,
    tempSL,
    tempTP1,
    tempTP2,
    showSmcZones,
    showLiquidityPools,
    showFibOte,
    showExecutionLines,
    quantEvaluation?.evaluatedAt,
    darkChart,
  ]);

  const liveRRRatio = useMemo(() => {
    const risk = Math.abs(tempEntry - tempSL);
    const reward = Math.abs(tempTP2 - tempEntry);
    if (!risk || !reward) return "N/A";
    return `1:${(reward / risk).toFixed(2)}`;
  }, [tempEntry, tempSL, tempTP2]);

  const handleLevelSyncClick = () => {
    if (onSyncLevels) {
      onSyncLevels({
        entry: tempEntry,
        stopLoss: tempSL,
        tp1: tempTP1,
        tp2: tempTP2,
      });
      setSyncStatus(true);
      setTimeout(() => setSyncStatus(false), 2000);
    }
  };

  const handleCapture = () => {
    if (chartRef.current && onCaptureScreenshot) {
      const dataUrl = chartRef.current.takeScreenshot().toDataURL("image/png");
      onCaptureScreenshot(dataUrl);
    }
  };

  const currentPriceDisplay = latestCandle
    ? formatPrice(latestCandle.close, symbol)
    : formatPrice(symbol.defaultPrice, symbol);

  const obCount = quantEvaluation?.overlays?.orderBlocks?.length || 0;
  const fvgCount = quantEvaluation?.overlays?.fairValueGaps?.length || 0;
  const poolCount = quantEvaluation?.overlays?.liquidityPools?.length || 0;

  return (
    <div
      className="bg-[#F1F4F8] border border-slate-300 rounded-xl p-5 space-y-4"
      id="live-tradingview-terminal-container"
    >
      {/* HEADER & REAL-TIME TELEMETRY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-300 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
            <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold">
              <span
                className={`h-2 w-2 rounded-full ${
                  telemetry.status === "CONNECTED"
                    ? "bg-emerald-600"
                    : telemetry.status === "ERROR"
                    ? "bg-rose-600"
                    : "bg-amber-500"
                }`}
              />
              {telemetry.provider}
            </span>
            <span className="text-slate-400">·</span>
            <span>{telemetry.latencyMs}ms</span>
            <span className="text-slate-400">·</span>
            <span>{candles.length} live bars</span>
            {quantEvaluation && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-slate-700 font-semibold">
                  {obCount} OB · {fvgCount} FVG · {poolCount} Liquidity Pools
                </span>
              </>
            )}
          </div>

          <h2 className="text-lg font-bold font-display text-slate-900 mt-1 flex items-center gap-2">
            <span>{symbol.name}</span>
            <span className="text-xs font-mono font-semibold text-slate-600">
              {symbol.ticker} · {timeframe}
            </span>
          </h2>
        </div>

        {/* Spot Price & Live Futures Metrics */}
        <div className="flex flex-wrap items-center gap-4 bg-[#E8ECF2] border border-slate-300 rounded-xl px-4 py-2.5">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
              Live Spot
            </span>
            <span className="text-lg font-mono font-bold text-slate-900 tabular-nums">
              {currentPriceDisplay}
            </span>
          </div>

          {symbol.marketType === "CRYPTO_PERP" && (futuresTelemetry || symbol.futuresMetrics) && (
            <>
              <div className="h-7 w-px bg-slate-300" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Funding (8h)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                  {futuresTelemetry
                    ? `${(futuresTelemetry.fundingRate * 100).toFixed(4)}%`
                    : symbol.futuresMetrics?.fundingRate}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-300 hidden sm:block" />
              <div className="hidden sm:block">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  OI &amp; 24h Δ
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">
                  {futuresTelemetry && futuresTelemetry.openInterestValue > 0
                    ? `$${(futuresTelemetry.openInterestValue / 1e9).toFixed(2)}B`
                    : symbol.futuresMetrics?.openInterestUsd || "Live"}
                  {futuresTelemetry?.oiDeltaPct24h !== undefined && (
                    <span
                      className={
                        futuresTelemetry.oiDeltaPct24h >= 0 ? "text-emerald-700 ml-1" : "text-rose-600 ml-1"
                      }
                    >
                      ({futuresTelemetry.oiDeltaPct24h > 0 ? "+" : ""}
                      {futuresTelemetry.oiDeltaPct24h}%)
                    </span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* OVERLAY CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#E8ECF2] border border-slate-300 rounded-xl p-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSmcZones(!showSmcZones)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showSmcZones
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-[#F1F4F8] border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>OB / FVG</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLiquidityPools(!showLiquidityPools)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showLiquidityPools
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-[#F1F4F8] border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>PDH / Liquidity</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFibOte(!showFibOte)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showFibOte
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-[#F1F4F8] border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>0.705 OTE</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExecutionLines(!showExecutionLines)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showExecutionLines
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-[#F1F4F8] border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {showExecutionLines ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>Entry / SL / TP</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRsi(!showRsi)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showRsi
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-[#F1F4F8] border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>RSI (14)</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkChart(!darkChart)}
            title="Toggle Slate / Dark Chart Canvas"
            className="flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border bg-[#F1F4F8] border-slate-300 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {darkChart ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{darkChart ? "Slate" : "Dark"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-mono text-slate-600 font-semibold tabular-nums">
            TP2 R:R: <strong className="text-emerald-700">{liveRRRatio}</strong>
          </span>

          {onCaptureScreenshot && (
            <button
              type="button"
              onClick={handleCapture}
              className="px-3 py-1.5 bg-[#F1F4F8] hover:bg-slate-200 text-xs font-semibold text-slate-800 rounded-lg border border-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Snapshot to AI</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLevelSyncClick}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              syncStatus
                ? "bg-emerald-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {syncStatus ? <Check className="h-3.5 w-3.5" /> : <Sliders className="h-3.5 w-3.5" />}
            <span>{syncStatus ? "Synced" : "Sync to Sizer"}</span>
          </button>
        </div>
      </div>

      {/* CHART MOUNTING POINT */}
      <div
        className={`relative border border-slate-300 rounded-xl overflow-hidden min-h-[430px] ${
          darkChart ? "bg-[#0F172A]" : "bg-[#F1F4F8]"
        }`}
      >
        {isLoading && (
          <div className="absolute inset-0 bg-[#E4E8EE]/90 backdrop-blur-xs flex flex-col items-center justify-center z-30 space-y-2">
            <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-800">
              Streaming 300 Live Candles from {telemetry.provider}...
            </p>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full h-[430px]" />

        {/* RSI SUB-PANE */}
        {showRsi && (
          <div
            className={`w-full h-[125px] border-t border-slate-300 relative ${
              darkChart ? "bg-[#111C33]" : "bg-[#E8ECF2]"
            }`}
          >
            <div ref={rsiContainerRef} className="w-full h-full" />
            <div
              className={`absolute top-2 left-4 text-[11px] font-mono font-semibold pointer-events-none select-none flex items-center gap-2 ${
                darkChart ? "text-slate-300" : "text-slate-600"
              }`}
            >
              <span>RSI (14) Momentum</span>
              <span className="opacity-60">· OB 70 / OS 30</span>
            </div>
          </div>
        )}
      </div>

      {/* RSI DIVERGENCES HUD */}
      {divergences.length > 0 && (
        <div className="p-3.5 rounded-xl bg-[#E8ECF2] border border-slate-300 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-600" />
              Detected RSI (14) Divergences
            </span>
            <span className="text-[11px] font-mono text-slate-600 font-semibold">
              {divergences.length} pattern{divergences.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {divergences.slice(-2).map((div, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  div.type === "BULLISH"
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                    : "bg-rose-50/80 border-rose-300 text-rose-950"
                }`}
              >
                <div className="flex items-center gap-2">
                  {div.type === "BULLISH" ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-rose-600" />
                  )}
                  <span className="font-semibold">{div.type} Divergence</span>
                </div>
                <span className="font-mono text-[11px] tabular-nums">
                  RSI {div.valRsi1.toFixed(1)} → {div.valRsi2.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANUAL EXECUTION SLIDERS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#E8ECF2] border border-slate-300 font-mono text-xs tabular-nums">
        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Entry Level</span>
            <span className="text-emerald-700 font-bold">{formatPrice(tempEntry, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.9 || 1}
            max={tempEntry * 1.1 || 1000}
            step={symbol.lotStepValue || (tempEntry < 5 ? 0.0001 : 0.1)}
            value={tempEntry}
            onChange={(e) => setTempEntry(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Invalidation SL</span>
            <span className="text-rose-700 font-bold">{formatPrice(tempSL, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.85 || 1}
            max={tempEntry * 1.15 || 1000}
            step={symbol.lotStepValue || (tempEntry < 5 ? 0.0001 : 0.1)}
            value={tempSL}
            onChange={(e) => setTempSL(parseFloat(e.target.value))}
            className="w-full accent-rose-600 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>TP1 (1.272)</span>
            <span className="text-emerald-700 font-bold">{formatPrice(tempTP1, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.85 || 1}
            max={tempEntry * 1.25 || 1200}
            step={symbol.lotStepValue || (tempEntry < 5 ? 0.0001 : 0.1)}
            value={tempTP1}
            onChange={(e) => setTempTP1(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>TP2 (1.618)</span>
            <span className="text-emerald-700 font-bold">{formatPrice(tempTP2, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.85 || 1}
            max={tempEntry * 1.35 || 1300}
            step={symbol.lotStepValue || (tempEntry < 5 ? 0.0001 : 0.1)}
            value={tempTP2}
            onChange={(e) => setTempTP2(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
