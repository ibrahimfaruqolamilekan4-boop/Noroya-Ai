import React, { useEffect, useRef, useState, useMemo } from "react";
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts";
import {
  Activity,
  Maximize2,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  TrendingDown,
  TrendingUp,
  Sliders,
  Radio,
  Flame,
  Shield,
  Clock,
} from "lucide-react";
import { SyntheticSymbol } from "../data/symbols";
import { useMarketData } from "../hooks/useMarketData";
import { formatPrice } from "../lib/quantEngine";

interface LiveTradingViewChartProps {
  symbol: SyntheticSymbol;
  timeframe?: string;
  analysisResult?: any;
  currentWorkspaceLevels?: { entry: number; stopLoss: number; tp1: number; tp2: number };
  onSyncLevels?: (levels: { entry: number; stopLoss: number; tp1: number; tp2: number }) => void;
  onCaptureScreenshot?: (dataUrl: string) => void;
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

  const swingLows = [];
  const swingHighs = [];

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

    if (dist >= 5 && dist <= 40) {
      if (newer.low < older.low && newer.rsi > older.rsi) {
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
  }

  for (let i = 1; i < swingHighs.length; i++) {
    const older = swingHighs[i - 1];
    const newer = swingHighs[i];
    const dist = newer.idx - older.idx;

    if (dist >= 5 && dist <= 40) {
      if (newer.high > older.high && newer.rsi < older.rsi) {
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
  }

  return divergences;
}

export default function LiveTradingViewChart({
  symbol,
  timeframe = "H1",
  analysisResult,
  currentWorkspaceLevels,
  onSyncLevels,
  onCaptureScreenshot,
}: LiveTradingViewChartProps) {
  // Real-time market data ingestion via centralized MarketDataService
  const { candles, latestCandle, futuresTelemetry, telemetry, isLoading } = useMarketData(symbol, timeframe);

  // Layout Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);

  // Local UI overlays
  const [showAiZones, setShowAiZones] = useState<boolean>(true);
  const [showFibLines, setShowFibLines] = useState<boolean>(true);
  const [showRsi, setShowRsi] = useState<boolean>(true);
  const [divergences, setDivergences] = useState<DivergenceInfo[]>([]);

  // Manual interactive levels
  const [tempEntry, setTempEntry] = useState<number>(0);
  const [tempSL, setTempSL] = useState<number>(0);
  const [tempTP1, setTempTP1] = useState<number>(0);
  const [tempTP2, setTempTP2] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<boolean>(false);

  // Sync levels with props or defaults
  useEffect(() => {
    if (currentWorkspaceLevels && currentWorkspaceLevels.entry > 0) {
      setTempEntry(currentWorkspaceLevels.entry);
      setTempSL(currentWorkspaceLevels.stopLoss);
      setTempTP1(currentWorkspaceLevels.tp1);
      setTempTP2(currentWorkspaceLevels.tp2);
    } else if (analysisResult?.tradeSetup) {
      const ts = analysisResult.tradeSetup;
      const base = Number(ts.entry) || symbol.defaultPrice;
      setTempEntry(base);
      setTempSL(Number(ts.stopLoss) || base * 0.98);
      if (Array.isArray(ts.takeProfits)) {
        setTempTP1(Number(ts.takeProfits[0]) || base * 1.03);
        setTempTP2(Number(ts.takeProfits[1]) || base * 1.06);
      }
    } else {
      const base = symbol.defaultPrice;
      setTempEntry(base);
      setTempSL(base * 0.98);
      setTempTP1(base * 1.03);
      setTempTP2(base * 1.06);
    }
  }, [analysisResult, currentWorkspaceLevels, symbol]);

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

    const chart: any = createChart(container, {
      width: container.clientWidth,
      height: 420,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#475569",
        fontFamily: "JetBrains Mono, monospace, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(226, 232, 240, 0.6)" },
        horzLines: { color: "rgba(226, 232, 240, 0.6)" },
      },
      rightPriceScale: {
        borderColor: "rgba(203, 213, 225, 0.6)",
        visible: true,
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "rgba(203, 213, 225, 0.6)",
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

    // RSI sub-pane
    let rsiChart: any = null;
    let rsiSeries: any = null;

    if (showRsi && rsiContainerRef.current) {
      rsiChart = createChart(rsiContainerRef.current, {
        width: rsiContainerRef.current.clientWidth,
        height: 140,
        layout: {
          background: { color: "#f8faf9" },
          textColor: "#64748b",
          fontFamily: "JetBrains Mono, monospace, sans-serif",
        },
        grid: {
          vertLines: { color: "rgba(226, 232, 240, 0.5)" },
          horzLines: { color: "rgba(226, 232, 240, 0.5)" },
        },
        rightPriceScale: {
          borderColor: "rgba(203, 213, 225, 0.5)",
          visible: true,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: "rgba(203, 213, 225, 0.5)",
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
        color: "rgba(220, 38, 38, 0.4)",
        lineWidth: 1,
        lineStyle: 1,
        title: "OB 70",
      });
      rsiSeries.createPriceLine({
        price: 50,
        color: "rgba(148, 163, 184, 0.3)",
        lineWidth: 1,
        lineStyle: 2,
        title: "MID 50",
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: "rgba(5, 150, 105, 0.4)",
        lineWidth: 1,
        lineStyle: 1,
        title: "OS 30",
      });

      rsiChartRef.current = rsiChart;
      rsiSeriesRef.current = rsiSeries;

      // Sync time scales
      const s1 = chart.timeScale();
      const s2 = rsiChart.timeScale();
      let syncing = false;
      s1.subscribeVisibleTimeRangeChange((range) => {
        if (syncing) return;
        syncing = true;
        s2.setVisibleRange(range);
        syncing = false;
      });
      s2.subscribeVisibleTimeRangeChange((range) => {
        if (syncing) return;
        syncing = true;
        s1.setVisibleRange(range);
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
  }, [symbol.ticker, showRsi]);

  // Update chart data whenever historical candles load from Bybit or Deriv
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

    // Calculate real RSI
    const rsiData = calculateRSI(formatted, 14);
    if (rsiSeriesRef.current && rsiData.length > 0) {
      rsiSeriesRef.current.setData(rsiData);
    }

    const divs = detectRsiDivergences(formatted, rsiData);
    setDivergences(divs);

    redrawPriceLines();
  }, [candles]);

  // Update live candle on every intra-candle tick
  useEffect(() => {
    if (!candleSeriesRef.current || !latestCandle) return;

    candleSeriesRef.current.update({
      time: latestCandle.timestamp as any,
      open: latestCandle.open,
      high: latestCandle.high,
      low: latestCandle.low,
      close: latestCandle.close,
    });
  }, [latestCandle]);

  // Clear existing price lines
  const clearPriceLines = () => {
    if (!candleSeriesRef.current) return;
    priceLinesRef.current.forEach((l) => {
      try {
        candleSeriesRef.current.removePriceLine(l);
      } catch {}
    });
    priceLinesRef.current = [];
  };

  // Redraw horizontal execution lines
  const redrawPriceLines = () => {
    if (!candleSeriesRef.current) return;
    clearPriceLines();

    if (tempEntry > 0) {
      const entryLine = candleSeriesRef.current.createPriceLine({
        price: tempEntry,
        color: "#059669",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "SMC 0.705 ENTRY",
      });
      priceLinesRef.current.push(entryLine);
    }

    if (tempSL > 0) {
      const slLine = candleSeriesRef.current.createPriceLine({
        price: tempSL,
        color: "#dc2626",
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "INVALIDATION SL",
      });
      priceLinesRef.current.push(slLine);
    }

    if (tempTP1 > 0) {
      const tp1Line = candleSeriesRef.current.createPriceLine({
        price: tempTP1,
        color: "#047857",
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "TP1 (1.272)",
      });
      priceLinesRef.current.push(tp1Line);
    }

    if (tempTP2 > 0) {
      const tp2Line = candleSeriesRef.current.createPriceLine({
        price: tempTP2,
        color: "#059669",
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "TP2 (1.618)",
      });
      priceLinesRef.current.push(tp2Line);
    }
  };

  useEffect(() => {
    redrawPriceLines();
  }, [tempEntry, tempSL, tempTP1, tempTP2]);

  const liveRRRatio = useMemo(() => {
    const risk = Math.abs(tempEntry - tempSL);
    const reward = Math.abs(tempTP1 - tempEntry);
    if (!risk || !reward) return "1:2.8";
    return `1:${(reward / risk).toFixed(2)}`;
  }, [tempEntry, tempSL, tempTP1]);

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

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4" id="live-tradingview-terminal-container">
      {/* HEADER & REAL-TIME TELEMETRY HUD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Active Feed Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>{telemetry.provider}</span>
            </div>

            {/* Latency Pill */}
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {telemetry.latencyMs}ms
            </span>

            {/* 300 Candles Backfilled Tag */}
            <span className="text-[11px] font-mono text-slate-600">
              {candles.length} bars
            </span>
          </div>

          <h2 className="text-lg font-bold font-display text-slate-900 mt-1 flex items-center gap-2">
            <span>{symbol.name}</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {timeframe}
            </span>
          </h2>
        </div>

        {/* Spot Price & Futures Telemetry */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
              Spot Price
            </span>
            <span className="text-lg font-mono font-bold text-slate-900 tabular-nums">
              {currentPriceDisplay}
            </span>
          </div>

          {symbol.marketType === "CRYPTO_PERP" && (futuresTelemetry || symbol.futuresMetrics) && (
            <>
              <div className="h-7 w-px bg-slate-200" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Funding Rate
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 tabular-nums">
                  {futuresTelemetry
                    ? `${(futuresTelemetry.fundingRate * 100).toFixed(4)}%`
                    : symbol.futuresMetrics?.fundingRate}
                </span>
              </div>
              <div className="h-7 w-px bg-slate-200 hidden sm:block" />
              <div className="hidden sm:block">
                <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                  Open Interest
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 tabular-nums">
                  {futuresTelemetry && futuresTelemetry.openInterestValue > 0
                    ? `$${(futuresTelemetry.openInterestValue / 1e9).toFixed(2)}B`
                    : symbol.futuresMetrics?.openInterestUsd}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* OVERLAY CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAiZones(!showAiZones)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border transition-colors cursor-pointer ${
              showAiZones
                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {showAiZones ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>SMC Levels</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRsi(!showRsi)}
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border transition-colors cursor-pointer ${
              showRsi
                ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {showRsi ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>RSI Momentum</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-mono text-slate-600 font-semibold tabular-nums">
            Live R:R: <strong className="text-emerald-700">{liveRRRatio}</strong>
          </span>

          {onCaptureScreenshot && (
            <button
              type="button"
              onClick={handleCapture}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 rounded-lg border border-slate-300 transition-colors cursor-pointer"
            >
              Capture &amp; Analyze
            </button>
          )}

          <button
            type="button"
            onClick={handleLevelSyncClick}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              syncStatus
                ? "bg-emerald-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
            }`}
          >
            {syncStatus ? <Check className="h-3.5 w-3.5" /> : <Sliders className="h-3.5 w-3.5" />}
            <span>{syncStatus ? "Synced" : "Sync Coordinates"}</span>
          </button>
        </div>
      </div>

      {/* CHART MOUNTING POINT */}
      <div className="relative bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[420px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center z-30 space-y-2">
            <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-800">
              Streaming 300 Historical Candles from {telemetry.provider}...
            </p>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full h-[420px]" />

        {/* RSI PANE */}
        {showRsi && (
          <div className="w-full h-[140px] border-t border-slate-200 bg-slate-50 relative">
            <div ref={rsiContainerRef} className="w-full h-full" />
            <div className="absolute top-2 left-4 text-[11px] font-mono text-slate-600 font-semibold pointer-events-none select-none flex items-center gap-2">
              <span>RSI (14) Momentum</span>
              <span className="text-slate-400">· Overbought 70 / Oversold 30</span>
            </div>
          </div>
        )}
      </div>

      {/* RSI DIVERGENCES HUD */}
      {divergences.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-600" />
              Detected Real-Time Divergences
            </span>
            <span className="text-[11px] font-mono text-emerald-700 font-semibold">
              Live Tick Scanner
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {divergences.slice(-2).map((div, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                  div.type === "BULLISH"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                    : "bg-red-50/70 border-red-200 text-red-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  {div.type === "BULLISH" ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-semibold">{div.type} Divergence</span>
                </div>
                <span className="font-mono text-[11px]">
                  RSI {div.valRsi1.toFixed(1)} → {div.valRsi2.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANUAL EXECUTION SLIDERS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs tabular-nums">
        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Entry Level</span>
            <span className="text-emerald-700 font-bold">{formatPrice(tempEntry, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.85 || 100}
            max={tempEntry * 1.15 || 1000}
            step={symbol.lotStepValue || 0.1}
            value={tempEntry}
            onChange={(e) => setTempEntry(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>Invalidation SL</span>
            <span className="text-red-600 font-bold">{formatPrice(tempSL, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.75 || 90}
            max={tempEntry * 1.1 || 990}
            step={symbol.lotStepValue || 0.1}
            value={tempSL}
            onChange={(e) => setTempSL(parseFloat(e.target.value))}
            className="w-full accent-red-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>TP1 (1.272)</span>
            <span className="text-emerald-700 font-bold">{formatPrice(tempTP1, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.9 || 100}
            max={tempEntry * 1.4 || 1200}
            step={symbol.lotStepValue || 0.1}
            value={tempTP1}
            onChange={(e) => setTempTP1(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between font-semibold text-slate-700">
            <span>TP2 (1.618)</span>
            <span className="text-emerald-700 font-bold">{formatPrice(tempTP2, symbol)}</span>
          </div>
          <input
            type="range"
            min={tempEntry * 0.95 || 100}
            max={tempEntry * 1.5 || 1300}
            step={symbol.lotStepValue || 0.1}
            value={tempTP2}
            onChange={(e) => setTempTP2(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
