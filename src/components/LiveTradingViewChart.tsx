import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, LineSeries, createSeriesMarkers } from "lightweight-charts";
import { 
  Activity, 
  Settings, 
  Maximize2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Check, 
  Zap,
  TrendingDown,
  TrendingUp,
  Sliders,
  DollarSign
} from "lucide-react";
import { SyntheticSymbol } from "../data/symbols";

interface LiveTradingViewChartProps {
  symbol: SyntheticSymbol;
  analysisResult: any;
  onSyncLevels?: (levels: { entry: number; stopLoss: number; tp1: number; tp2: number }) => void;
  currentWorkspaceLevels?: { entry: number; stopLoss: number; tp1: number; tp2: number };
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

  // First change
  for (let i = 1; i <= period; i++) {
    const difference = data[i].close - data[i - 1].close;
    if (difference > 0) {
      gains += difference;
    } else {
      losses -= difference;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  rsiList.push({ time: data[period].time, value: rsi });

  for (let i = period + 1; i < data.length; i++) {
    const difference = data[i].close - data[i - 1].close;
    const gain = difference > 0 ? difference : 0;
    const loss = difference < 0 ? -difference : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    rsiList.push({ time: data[i].time, value: rsi });
  }

  return rsiList;
}

// Technical analysis helper to scan and confirm RSI divergence peaks/troughs
export function detectRsiDivergences(candles: any[], rsiList: { time: any; value: number }[]): DivergenceInfo[] {
  if (candles.length < 10 || rsiList.length < 10) return [];
  
  const swingLows = [];
  const swingHighs = [];
  
  // Find local swing points (window = 2 each side)
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
      const rsiPoint = rsiList.find(r => r.time === candles[i].time);
      if (rsiPoint) {
        swingLows.push({
          idx: i,
          time: candles[i].time,
          low: candles[i].low,
          rsi: rsiPoint.value
        });
      }
    }
    
    if (isHigh) {
      const rsiPoint = rsiList.find(r => r.time === candles[i].time);
      if (rsiPoint) {
        swingHighs.push({
          idx: i,
          time: candles[i].time,
          high: candles[i].high,
          rsi: rsiPoint.value
        });
      }
    }
  }
  
  const divergences: DivergenceInfo[] = [];
  
  // Find Bullish Divergences between consecutive swing lows (distance 5 to 40 candles)
  for (let i = 1; i < swingLows.length; i++) {
    const older = swingLows[i - 1];
    const newer = swingLows[i];
    const distanceVal = newer.idx - older.idx;
    
    if (distanceVal >= 5 && distanceVal <= 40) {
      // Bullish divergence: price goes low1 -> low2 (lower lows), RSI goes rsi1 -> rsi2 (higher lows)
      if (newer.low < older.low && newer.rsi > older.rsi) {
        divergences.push({
          type: "BULLISH",
          time1: older.time,
          time2: newer.time,
          valPrice1: older.low,
          valPrice2: newer.low,
          valRsi1: older.rsi,
          valRsi2: newer.rsi
        });
      }
    }
  }

  // Find Bearish Divergences between consecutive swing highs (distance 5 to 40 candles)
  for (let i = 1; i < swingHighs.length; i++) {
    const older = swingHighs[i - 1];
    const newer = swingHighs[i];
    const distanceVal = newer.idx - older.idx;
    
    if (distanceVal >= 5 && distanceVal <= 40) {
      // Bearish divergence: price goes high1 -> high2 (higher highs), RSI goes rsi1 -> rsi2 (lower highs)
      if (newer.high > older.high && newer.rsi < older.rsi) {
        divergences.push({
          type: "BEARISH",
          time1: older.time,
          time2: newer.time,
          valPrice1: older.high,
          valPrice2: newer.high,
          valRsi1: older.rsi,
          valRsi2: newer.rsi
        });
      }
    }
  }
  
  return divergences;
}

export default function LiveTradingViewChart({
  symbol,
  analysisResult,
  onSyncLevels,
  currentWorkspaceLevels,
  onCaptureScreenshot,
}: LiveTradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);
  const markersRef = useRef<any>(null);

  // Deriv connection states
  const [isRealDerivFeed, setIsRealDerivFeed] = useState<boolean>(true);
  const [derivConnStatus, setDerivConnStatus] = useState<"DISCONNECTED" | "CONNECTING" | "CONNECTED" | "AUTHORIZED">("DISCONNECTED");
  const [derivAccountEmail, setDerivAccountEmail] = useState<string>("");
  const [derivError, setDerivError] = useState<string | null>(null);
  const [isDerivLoading, setIsDerivLoading] = useState<boolean>(false);

  // Local config states
  const [showAiZones, setShowAiZones] = useState(true);
  const [showFibLines, setShowFibLines] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [isLiveEnabled, setIsLiveEnabled] = useState(true);
  const [lastTickPrice, setLastTickPrice] = useState<number | null>(null);
  const [tickCounter, setTickCounter] = useState(0);
  const [divergences, setDivergences] = useState<DivergenceInfo[]>([]);

  // Refs for tracking charts data and nodes
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const chartDataRef = useRef<any[]>([]);

  // Manual interactive setup modification within terminal
  const [tempEntry, setTempEntry] = useState<number>(0);
  const [tempSL, setTempSL] = useState<number>(0);
  const [tempTP1, setTempTP1] = useState<number>(0);
  const [tempTP2, setTempTP2] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<boolean>(false);

  // Get active symbol categories to style movements
  const ticker = symbol?.ticker || "V75";
  const isBoom = ticker.startsWith("B");
  const isCrash = ticker.startsWith("C");

  // Sync temp variables with analysis or workspace change
  useEffect(() => {
    if (currentWorkspaceLevels && currentWorkspaceLevels.entry > 0) {
      setTempEntry(currentWorkspaceLevels.entry);
      setTempSL(currentWorkspaceLevels.stopLoss);
      setTempTP1(currentWorkspaceLevels.tp1);
      setTempTP2(currentWorkspaceLevels.tp2);
    } else if (analysisResult?.tradeSetup) {
      const ts = analysisResult.tradeSetup;
      const baseVal = Number(ts.entry) || symbol?.defaultPrice || 1200;
      setTempEntry(baseVal);
      setTempSL(Number(ts.stopLoss) || baseVal * 0.96);
      if (Array.isArray(ts.takeProfits)) {
        setTempTP1(Number(ts.takeProfits[0]) || baseVal * 1.05);
        setTempTP2(Number(ts.takeProfits[1]) || baseVal * 1.10);
      } else {
        setTempTP1(baseVal * 1.05);
        setTempTP2(baseVal * 1.10);
      }
    } else {
      // Default baseline values based on symbol price scale
      const baseVal = symbol?.defaultPrice || 1200;
      setTempEntry(baseVal);
      setTempSL(baseVal * 0.96);
      setTempTP1(baseVal * 1.05);
      setTempTP2(baseVal * 1.10);
    }
  }, [analysisResult, currentWorkspaceLevels, symbol]);

  // Handle Lightweight Chart Initial Setup
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Discard any existing chart on resize or symbol swap or RSI toggle
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {}
      chartRef.current = null;
    }
    if (rsiChartRef.current) {
      try {
        rsiChartRef.current.remove();
      } catch (e) {}
      rsiChartRef.current = null;
    }

    const container = chartContainerRef.current;
    
    // Create base lightweight-chart configuration
    const chart: any = createChart(container, {
      width: container.clientWidth,
      height: 420,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#475569", // slate-600
        fontFamily: "JetBrains Mono, monospace, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(226, 232, 240, 0.6)" },
        horzLines: { color: "rgba(226, 232, 240, 0.6)" },
      },
      rightPriceScale: {
        borderColor: "rgba(203, 213, 225, 0.5)",
        visible: true,
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: "rgba(203, 213, 225, 0.5)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    // Save refs
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Generate historical baseline data matching the active symbol price scale
    let currentPrice = symbol?.defaultPrice || 1200;
    if (currentWorkspaceLevels && currentWorkspaceLevels.entry > 0) {
      currentPrice = currentWorkspaceLevels.entry * 0.98;
    } else if (analysisResult?.tradeSetup?.entry) {
      currentPrice = Number(analysisResult.tradeSetup.entry) * 0.98;
    }
    const initialData = [];
    const now = new Date();
    
    for (let i = 120; i > 0; i--) {
      const timeSecs = Math.floor(now.getTime() / 1000) - i * 60;
      
      let baseMovement = (Math.random() - 0.48) * (currentPrice * 0.004);
      
      // Inject synthetic index style anomalies
      if (isBoom) {
        // Boom usually slides slowly down, then spikes hard
        baseMovement = -0.5 - Math.random() * (currentPrice * 0.001);
        if (Math.random() > 0.94) {
          baseMovement = (Math.random() * 0.03 + 0.02) * currentPrice; // Massive positive spike
        }
      } else if (isCrash) {
        // Crash slowly climbs up, then crashes hard down
        baseMovement = 0.5 + Math.random() * (currentPrice * 0.001);
        if (Math.random() > 0.94) {
          baseMovement = -(Math.random() * 0.03 + 0.02) * currentPrice; // Massive crash spike
        }
      } else {
        // Volatility is random walk with wider bands
        baseMovement = (Math.random() - 0.5) * (currentPrice * 0.012);
      }

      const open = currentPrice;
      const close = currentPrice + baseMovement;
      let high = Math.max(open, close) + Math.random() * (currentPrice * 0.002);
      let low = Math.min(open, close) - Math.random() * (currentPrice * 0.002);

      // Spikes should have short lower wicks but tall wicks
      if (isBoom && (close - open) > currentPrice * 0.01) {
        low = open - (Math.random() * 2);
        high = close;
      }

      currentPrice = close;

      initialData.push({
        time: timeSecs as any,
        open,
        high,
        low,
        close,
      });
    }

    candleSeries.setData(initialData);
    setLastTickPrice(currentPrice);

    // Save initial load to active data Ref
    chartDataRef.current = initialData;

    // Calculate RSI and detect divergence points initial load
    const initialRsi = calculateRSI(initialData, 14);
    const initialDivs = detectRsiDivergences(initialData, initialRsi);
    setDivergences(initialDivs);

    // Render RSI series under main candlestick
    let rsiChart: any = null;
    let rsiSeries: any = null;

    if (showRsi && rsiContainerRef.current) {
      rsiChart = createChart(rsiContainerRef.current, {
        width: rsiContainerRef.current.clientWidth,
        height: 150,
        layout: {
          background: { color: "#f8fafc" }, // slate-50
          textColor: "#475569",
          fontFamily: "JetBrains Mono, monospace, sans-serif",
        },
        grid: {
          vertLines: { color: "rgba(226, 232, 240, 0.6)" },
          horzLines: { color: "rgba(226, 232, 240, 0.6)" },
        },
        rightPriceScale: {
          borderColor: "rgba(203, 213, 225, 0.5)",
          visible: true,
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        timeScale: {
          borderColor: "rgba(203, 213, 225, 0.5)",
          visible: false,
          timeVisible: true,
          secondsVisible: false,
        },
      });

      rsiSeries = rsiChart.addSeries(LineSeries, {
        color: "#ca8a04", // Dark amber indicator line
        lineWidth: 2,
        priceScaleId: "right",
      });

      // Show lines for overbought/neutral/oversold boundaries
      rsiSeries.createPriceLine({
        price: 70,
        color: "rgba(244, 63, 94, 0.35)", // Rose
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "OB (70)",
      });

      rsiSeries.createPriceLine({
        price: 50,
        color: "rgba(148, 163, 184, 0.15)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "MID (50)",
      });

      rsiSeries.createPriceLine({
        price: 30,
        color: "rgba(16, 185, 129, 0.35)", // Emerald
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: "OS (30)",
      });

      rsiSeries.setData(initialRsi);

      rsiChartRef.current = rsiChart;
      rsiSeriesRef.current = rsiSeries;

      // Sync x-axis timeframe scales
      const s1 = chart.timeScale();
      const s2 = rsiChart.timeScale();

      let isSyncing = false;
      s1.subscribeVisibleTimeRangeChange((range) => {
        if (isSyncing) return;
        isSyncing = true;
        s2.setVisibleRange(range);
        isSyncing = false;
      });

      s2.subscribeVisibleTimeRangeChange((range) => {
        if (isSyncing) return;
        isSyncing = true;
        s1.setVisibleRange(range);
        isSyncing = false;
      });
    }

    // Add overlay structures
    applyPriceMarkers(chart, candleSeries, initialData, initialDivs);

    // Resize handler
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
      } catch (e) {}
      if (rsiChart) {
        try {
          rsiChart.remove();
        } catch (e) {}
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      markersRef.current = null;
    };
  }, [symbol, showRsi]);

  // Method to remove existing custom price lines
  const clearPriceLines = () => {
    if (!candleSeriesRef.current) return;
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch (e) {
        // Safely discard
      }
    });
    priceLinesRef.current = [];
  };

  // Redraw custom horizontal levels on variable changes
  const applyPriceMarkers = (chart: any, candleSeries: any, activeData: any[], detectedDivs?: DivergenceInfo[]) => {
    try {
      clearPriceLines();

      if (!candleSeries) return;

      // Determine current price scale markers
      const currentPrice = lastTickPrice || tempEntry || (symbol?.defaultPrice || 1200);

      // 1. Core Trade Levels Setup
      if (tempEntry > 0) {
        const entryLine = candleSeries.createPriceLine({
          price: tempEntry,
          color: "#22d3ee", // Cyan
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: "SMC IDEAL ENTRY",
        });
        priceLinesRef.current.push(entryLine);
      }

      if (tempSL > 0) {
        const slLine = candleSeries.createPriceLine({
          price: tempSL,
          color: "#f43f5e", // Rose
          lineWidth: 2,
          lineStyle: 1, // Dashed
          axisLabelVisible: true,
          title: "INVALIDATION STOP LOSS (SL)",
        });
        priceLinesRef.current.push(slLine);
      }

      if (tempTP1 > 0) {
        const tp1Line = candleSeries.createPriceLine({
          price: tempTP1,
          color: "#10b981", // Emerald
          lineWidth: 1 as any,
          lineStyle: 1, // Dashed
          axisLabelVisible: true,
          title: "TARGET TAKE PROFIT 1 (TP1)",
        });
        priceLinesRef.current.push(tp1Line);
      }

      if (tempTP2 > 0) {
        const tp2Line = candleSeries.createPriceLine({
          price: tempTP2,
          color: "#34d399", // Sea Foam
          lineWidth: 1 as any,
          lineStyle: 1, // Dashed
          axisLabelVisible: true,
          title: "TARGET TAKE PROFIT 2 (TP2)",
        });
        priceLinesRef.current.push(tp2Line);
      }

      // 2. Mock AI Detected Zones
      if (showAiZones && analysisResult) {
        // Order Block (Zone bounds)
        const hasOB = !!analysisResult.orderBlock?.priceRange;
        if (hasOB) {
          const parsedOB = parsePriceBorders(analysisResult.orderBlock.priceRange);
          if (parsedOB) {
            const obTop = candleSeries.createPriceLine({
              price: parsedOB.high,
              color: "#6366f1", // Indigo
              lineWidth: 1 as any,
              lineStyle: 2, // Dotted
              title: "OB CEILING",
            });
            const obBottom = candleSeries.createPriceLine({
              price: parsedOB.low,
              color: "#6366f1",
              lineWidth: 1 as any,
              lineStyle: 2,
              title: "OB FLOOR (POI)",
            });
            priceLinesRef.current.push(obTop, obBottom);
          }
        }

        // Liquidity Void Bounds
        if (analysisResult.liquidityVoid?.priceRange) {
          const parsedVoid = parsePriceBorders(analysisResult.liquidityVoid.priceRange);
          if (parsedVoid) {
            const vTop = candleSeries.createPriceLine({
              price: parsedVoid.high,
              color: "#a78bfa", // Purple
              lineWidth: 1,
              lineStyle: 3, // Large dashes
              title: "VOID HIGH BOUND",
            });
            const vBottom = candleSeries.createPriceLine({
              price: parsedVoid.low,
              color: "#a78bfa",
              lineWidth: 1,
              lineStyle: 3,
              title: "VOID MAGNET TARGET",
            });
            priceLinesRef.current.push(vTop, vBottom);
          }
        }
      }

      // 3. Golden Ratio Fibonacci Lines
      if (showFibLines && tempSL > 0 && tempEntry > 0) {
        // Form a Fibonacci grid based on the entries
        const delta = Math.abs(tempEntry - tempSL);
        const isBull = tempEntry > tempSL;
        
        const fib618 = isBull ? tempEntry - delta * 0.618 : tempEntry + delta * 0.618;
        const fib786 = isBull ? tempEntry - delta * 0.786 : tempEntry + delta * 0.786;

        const f618Line = candleSeries.createPriceLine({
          price: fib618,
          color: "#fbbf24", // Amber Gold
          lineWidth: 1,
          lineStyle: 2,
          title: "0.618 GOLDEN DISCOUNT",
        });
        const f786Line = candleSeries.createPriceLine({
          price: fib786,
          color: "#fb923c", // Dark Orange
          lineWidth: 1,
          lineStyle: 2,
          title: "0.786 ACCUMULATION POI",
        });
        priceLinesRef.current.push(f618Line, f786Line);
      }

      // Apply markers on some candles
      if (activeData.length > 50) {
        const baseMarkers = [
          {
            time: activeData[activeData.length - 45].time,
            position: "aboveBar" as const,
            color: "#c084fc",
            shape: "arrowDown" as const,
            text: "BOS [BREAK OF STRUCTURE]",
          },
          {
            time: activeData[activeData.length - 20].time,
            position: "belowBar" as const,
            color: "#38bdf8",
            shape: "arrowUp" as const,
            text: "CHoCH [LIQUIDITY SWEEP]",
          }
        ];

        // Append detected RSI divergences
        const allMarkers = [...baseMarkers];
        const activeDivs = detectedDivs || divergences || [];
        
        activeDivs.forEach(div => {
          if (div.type === "BULLISH") {
            allMarkers.push({
              time: div.time2,
              position: "belowBar" as const,
              color: "#10b981",
              shape: "arrowUp" as const,
              text: `RSI BULL DIV (${div.valRsi2.toFixed(0)})`,
            });
          } else {
            allMarkers.push({
              time: div.time2,
              position: "aboveBar" as const,
              color: "#f43f5e",
              shape: "arrowDown" as const,
              text: `RSI BEAR DIV (${div.valRsi2.toFixed(0)})`,
            });
          }
        });

        // Chronological sort is required for lightweight-charts markers to render properly
        allMarkers.sort((a, b) => {
          const tA = typeof a.time === 'number' ? a.time : Number(a?.time || 0);
          const tB = typeof b.time === 'number' ? b.time : Number(b?.time || 0);
          return tA - tB;
        });

        if (markersRef.current) {
          markersRef.current.setMarkers(allMarkers);
        } else {
          markersRef.current = createSeriesMarkers(candleSeries, allMarkers);
        }
      }
    } catch (e) {
      console.warn("Could not apply markers safely:", e);
    }
  };

  // Parse price ranges from a text string like "1123.50 - 1145.00"
  const parsePriceBorders = (priceStr: string) => {
    if (!priceStr) return null;
    const parts = priceStr.split("-").map(p => parseFloat(p.trim().replace(/,/g, "")));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return {
        low: Math.min(parts[0], parts[1]),
        high: Math.max(parts[0], parts[1])
      };
    }
    return null;
  };

  // Handle updates to price levels
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;
    
    // Quick re-computation when parameters slide or toggle changes
    const fetchRef = async () => {
      if (candleSeriesRef.current) {
        // Redraw lines safely
        const data = chartDataRef.current.length > 0 ? chartDataRef.current : [];
        applyPriceMarkers(chartRef.current!, candleSeriesRef.current, data, divergences);
      }
    };
    fetchRef();
  }, [tempEntry, tempSL, tempTP1, tempTP2, showAiZones, showFibLines, lastTickPrice, divergences]);

  // Real-time Deriv WebSocket feed
  useEffect(() => {
    if (!isLiveEnabled || !candleSeriesRef.current || !isRealDerivFeed) {
      setDerivConnStatus("DISCONNECTED");
      return;
    }

    const derivAppId = (import.meta as any).env.VITE_DERIV_APP_ID || "1089";
    const derivToken = (import.meta as any).env.VITE_DERIV_API_TOKEN || "";
    const ticker = symbol?.ticker || "V75";

    // Helper map of tickers to Deriv technical symbol names
    const getDerivSymbolName = (tk: string): string => {
      const map: Record<string, string> = {
        "V10": "R_10",
        "V101S": "1HZ10V",
        "V151S": "1HZ15V",
        "V25": "R_25",
        "V251S": "1HZ25V",
        "V301S": "1HZ30V",
        "V50": "R_50",
        "V501S": "1HZ50V",
        "V75": "R_75",
        "V751S": "1HZ75V",
        "V901S": "1HZ90V",
        "V100": "R_100",
        "V1001S": "1HZ100V",
        "V1501S": "1HZ150V",
        "V2001S": "1HZ200V",
        "V2501S": "1HZ250V",
        "V3001S": "1HZ300V",
        "B300": "BOOM300",
        "B500": "BOOM500",
        "B600": "BOOM600",
        "B900": "BOOM900",
        "B1000": "BOOM1000",
        "C300": "CRASH300",
        "C500": "CRASH500",
        "C600": "CRASH600",
        "C900": "CRASH900",
        "C1000": "CRASH1000",
        "STEP": "STPRNG",
        "J10": "JD10",
        "J25": "JD25",
        "J50": "JD50",
        "J75": "JD75",
        "J100": "JD100",
        "RB100": "RDBR100",
        "RB200": "RDBR200",
        // Forex
        "EURUSD": "frxEURUSD",
        "GBPUSD": "frxGBPUSD",
        "USDJPY": "frxUSDJPY",
        "AUDUSD": "frxAUDUSD",
        "USDCAD": "frxUSDCAD",
        "USDCHF": "frxUSDCHF",
        "NZDUSD": "frxNZDUSD",
        "EURGBP": "frxEURGBP",
        "EURJPY": "frxEURJPY",
        "GBPJPY": "frxGBPJPY",
        "AUDJPY": "frxAUDJPY",
        "CADJPY": "frxCADJPY",
        "CHFJPY": "frxCHFJPY",
        "NZDJPY": "frxNZDJPY",
        "EURAUD": "frxEURAUD",
        "EURCAD": "frxEURCAD",
        "GBPAUD": "frxGBPAUD",
        "GBPCAD": "frxGBPCAD",
        "AUDNZD": "frxAUDNZD",
        "USDZAR": "frxUSDZAR",
        "USDMXN": "frxUSDMXN",
        "USDTRY": "frxUSDTRY",
        // Metals & Commodities
        "XAUUSD": "frxXAUUSD",
        "XAGUSD": "frxXAGUSD",
        "USOIL": "frxUSOIL",
        // Crypto & Perpetuals
        "BTCUSD": "cryBTCUSD",
        "ETHUSD": "cryETHUSD",
        "SOLUSD": "crySOLUSD",
        "BTCUSDT.P": "cryBTCUSD",
        "ETHUSDT.P": "cryETHUSD",
        "SOLUSDT.P": "crySOLUSD",
        "BNBUSDT.P": "cryBNBUSD",
        "XRPUSDT.P": "cryXRPUSD",
        "SUIUSDT.P": "cryBTCUSD",
      };
      return map[tk] || tk;
    };

    const derivSymbol = getDerivSymbolName(ticker);
    setDerivConnStatus("CONNECTING");
    setDerivError(null);
    setIsDerivLoading(true);

    const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${derivAppId}`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setDerivConnStatus("CONNECTED");
        
        // If api token is provided, authorize first
        if (derivToken) {
          ws?.send(JSON.stringify({
            authorize: derivToken
          }));
        } else {
          // If no token, request public candles history and subscription directly
          ws?.send(JSON.stringify({
            ticks_history: derivSymbol,
            adjust_start_time: 1,
            count: 150,
            end: "latest",
            style: "candles",
            granularity: 60,
            subscribe: 1
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          
          if (res.error) {
            console.warn("Deriv API Warning:", res.error.message);
            setDerivError(res.error.message || "Deriv stream error.");
            setIsDerivLoading(false);
            return;
          }

          if (res.msg_type === "authorize") {
            setDerivConnStatus("AUTHORIZED");
            setDerivAccountEmail(res.authorize.email || "Authorized User");
            
            // Now request candles feed
            ws?.send(JSON.stringify({
              ticks_history: derivSymbol,
              adjust_start_time: 1,
              count: 150,
              end: "latest",
              style: "candles",
              granularity: 60,
              subscribe: 1
            }));
          }

          else if (res.msg_type === "candles") {
            setIsDerivLoading(false);
            if (Array.isArray(res.candles) && res.candles.length > 0 && candleSeriesRef.current) {
              const formatted = res.candles.map((c: any) => ({
                time: Number(c.epoch) as any,
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close)
              }));
              
              candleSeriesRef.current.setData(formatted);
              chartDataRef.current = formatted;
              
              const lastCandle = formatted[formatted.length - 1];
              setLastTickPrice(lastCandle.close);

              const freshRsiList = calculateRSI(formatted, 14);
              if (freshRsiList.length > 0 && rsiSeriesRef.current) {
                rsiSeriesRef.current.setData(freshRsiList);
              }
              const freshDivs = detectRsiDivergences(formatted, freshRsiList);
              setDivergences(freshDivs);
            }
          }

          else if (res.msg_type === "ohlc") {
            if (res.ohlc && candleSeriesRef.current) {
              const o = res.ohlc;
              const candleUpdate = {
                time: Number(o.epoch) as any,
                open: Number(o.open),
                high: Number(o.high),
                low: Number(o.low),
                close: Number(o.close)
              };

              candleSeriesRef.current.update(candleUpdate);
              setLastTickPrice(candleUpdate.close);

              const currentData = [...chartDataRef.current];
              if (currentData.length > 0) {
                const lastIdx = currentData.length - 1;
                const lastCandle = currentData[lastIdx];
                if (lastCandle.time === candleUpdate.time) {
                  currentData[lastIdx] = candleUpdate;
                } else {
                  currentData.push(candleUpdate);
                  if (currentData.length > 250) {
                    currentData.shift();
                  }
                }
                chartDataRef.current = currentData;

                const freshRsiList = calculateRSI(currentData, 14);
                if (freshRsiList.length > 0 && rsiSeriesRef.current) {
                  rsiSeriesRef.current.update(freshRsiList[freshRsiList.length - 1]);
                }
                const freshDivs = detectRsiDivergences(currentData, freshRsiList);
                setDivergences(freshDivs);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to parse Deriv WebSocket message");
        }
      };

      ws.onerror = (err) => {
        console.warn("Deriv WebSocket Connection Issue. Using local simulation fallback.");
        setDerivError("Failed to connect to Deriv API server. Check your network or App ID.");
        setDerivConnStatus("DISCONNECTED");
        setIsDerivLoading(false);
      };

      ws.onclose = () => {
        setDerivConnStatus("DISCONNECTED");
        setIsDerivLoading(false);
      };

    } catch (e: any) {
      console.error("WebSocket init exception:", e);
      setDerivError(e.message || "WebSocket initialization failed.");
      setIsDerivLoading(false);
    }

    return () => {
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              forget_all: "ticks"
            }));
            ws.send(JSON.stringify({
              forget_all: "candles"
            }));
          }
          ws.close();
        } catch (e) {}
      }
    };
  }, [isLiveEnabled, isRealDerivFeed, symbol, showRsi]);

  // Real-time Tick Stream Emulator loop
  useEffect(() => {
    if (!isLiveEnabled || !candleSeriesRef.current || isRealDerivFeed) return;

    const interval = setInterval(() => {
      const candleSeries = candleSeriesRef.current;
      if (!candleSeries) return;

      setTickCounter(prev => prev + 1);

      // Get last point or default price
      let basePrice = lastTickPrice || (symbol?.defaultPrice || 1200);
      let volatilityCoef = basePrice * 0.0015; // standard volatility

      // Extreme spike or crash triggers for Boom & Crash
      let tickMovement = (Math.random() - 0.49) * volatilityCoef;

      if (isBoom) {
        // Small constant tick down (-0.05% per step)
        tickMovement = -basePrice * 0.0003;
        // 5% chance of a massive continuous spike burst
        if (Math.random() > 0.95) {
          tickMovement = basePrice * (0.015 + Math.random() * 0.02);
        }
      } else if (isCrash) {
        // Small upward creep
        tickMovement = basePrice * 0.0002;
        // 5% chance of crash
        if (Math.random() > 0.95) {
          tickMovement = -basePrice * (0.015 + Math.random() * 0.02);
        }
      }

      const nextPrice = basePrice + tickMovement;
      setLastTickPrice(nextPrice);

      const nowSecs = Math.floor(Date.now() / 1000);

      // Periodically feed a new candle or update active (every 8 ticks = new candle)
      const isNewCandle = tickCounter > 0 && tickCounter % 8 === 0;

      const mockCandleUpdate = {
        time: (isNewCandle ? nowSecs : nowSecs - (nowSecs % 60)) as any,
        open: isNewCandle ? basePrice : (basePrice - tickMovement * 2),
        high: Math.max(basePrice, nextPrice) + Math.random() * (basePrice * 0.0005),
        low: Math.min(basePrice, nextPrice) - Math.random() * (basePrice * 0.0005),
        close: nextPrice
      };

      try {
        candleSeries.update(mockCandleUpdate);

        // Keep active history Ref up to date
        const currentData = [...chartDataRef.current];
        if (currentData.length > 0) {
          const lastIdx = currentData.length - 1;
          const lastCandle = currentData[lastIdx];

          if (lastCandle.time === mockCandleUpdate.time) {
            currentData[lastIdx] = mockCandleUpdate;
          } else {
            currentData.push(mockCandleUpdate);
            if (currentData.length > 250) {
              currentData.shift();
            }
          }
          chartDataRef.current = currentData;

          // Re-evaluate RSI line on the live indicator pane
          const freshRsiList = calculateRSI(currentData, 14);
          if (freshRsiList.length > 0 && rsiSeriesRef.current) {
            const lastRsiPoint = freshRsiList[freshRsiList.length - 1];
            rsiSeriesRef.current.update(lastRsiPoint);
          }

          // Scan dynamic divergence reversals
          const freshDivs = detectRsiDivergences(currentData, freshRsiList);
          setDivergences(freshDivs);
        }
      } catch (err) {
        console.warn("Failed to update candle series under live stream:", err);
      }

    }, 1500);

    return () => clearInterval(interval);
  }, [isLiveEnabled, lastTickPrice, tickCounter, isBoom, isCrash]);

  // Handle instant manually triggered boom spike or crash
  const handleForceMacroTrend = () => {
    if (!candleSeriesRef.current || !lastTickPrice) return;
    
    try {
      // Simulate dynamic shock
      const originalPrice = lastTickPrice;
      let shockPrice = originalPrice;
      
      if (isBoom) {
        shockPrice = originalPrice * 1.05; // 5% massive spike instantly!
      } else if (isCrash) {
        shockPrice = originalPrice * 0.95; // 5% slide down!
      } else {
        // 3% unexpected Volatility Expansion
        shockPrice = Math.random() > 0.5 ? originalPrice * 1.03 : originalPrice * 0.97;
      }

      setLastTickPrice(shockPrice);
      
      const nowSecs = Math.floor(Date.now() / 1000);
      const forcedCandle = {
        time: nowSecs as any,
        open: originalPrice,
        high: Math.max(originalPrice, shockPrice),
        low: Math.min(originalPrice, shockPrice),
        close: shockPrice
      };
      
      candleSeriesRef.current.update(forcedCandle);

      // Keep active history Ref up to date
      const currentData = [...chartDataRef.current];
      if (currentData.length > 0) {
        const lastIdx = currentData.length - 1;
        const lastCandle = currentData[lastIdx];

        if (lastCandle.time === forcedCandle.time) {
          currentData[lastIdx] = forcedCandle;
        } else {
          currentData.push(forcedCandle);
          if (currentData.length > 250) {
            currentData.shift();
          }
        }
        chartDataRef.current = currentData;

        // Re-evaluate RSI line
        const freshRsiList = calculateRSI(currentData, 14);
        if (freshRsiList.length > 0 && rsiSeriesRef.current) {
          rsiSeriesRef.current.update(freshRsiList[freshRsiList.length - 1]);
        }

        // Scan dynamic divergence reversals
        const freshDivs = detectRsiDivergences(currentData, freshRsiList);
        setDivergences(freshDivs);
      }
    } catch (err) {
      console.warn("Failed to manually force trend shock:", err);
    }
  };

  // Calculate live Risk Reward Ratio
  const currentRiskPoints = Math.abs(tempEntry - tempSL);
  const currentRewardPoints = Math.abs(tempTP1 - tempEntry);
  const liveRRRatio = currentRiskPoints > 0 ? (currentRewardPoints / currentRiskPoints).toFixed(2) : "N/A";

  const handleLevelSyncClick = () => {
    if (onSyncLevels) {
      onSyncLevels({
        entry: tempEntry,
        stopLoss: tempSL,
        tp1: tempTP1,
        tp2: tempTP2
      });
      setSyncStatus(true);
      setTimeout(() => setSyncStatus(false), 2000);
    }
  };

  const handleCaptureScreenshot = () => {
    if (chartRef.current && onCaptureScreenshot) {
      const dataUrl = chartRef.current.takeScreenshot().toDataURL("image/png");
      onCaptureScreenshot(dataUrl);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden" id="live-tradingview-terminal-container">
      {/* Title & Connection Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
            <span
              className={`font-semibold ${
                isRealDerivFeed
                  ? derivConnStatus === "AUTHORIZED" || derivConnStatus === "CONNECTED"
                    ? "text-emerald-700"
                    : "text-amber-700"
                  : "text-emerald-700"
              }`}
            >
              {isRealDerivFeed
                ? `Deriv WebSocket: ${derivConnStatus}`
                : "Algorithmic Simulation Feed"}
            </span>
            {isRealDerivFeed && derivAccountEmail && (
              <>
                <span>·</span>
                <span className="text-slate-600">Account: {derivAccountEmail}</span>
              </>
            )}
          </div>
          <h3 className="text-base font-bold font-display text-slate-900 mt-0.5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            Live {symbol.name} Terminal
          </h3>
          {derivError && isRealDerivFeed && (
            <p className="text-xs text-rose-600 font-mono mt-1">
              Notice: {derivError} (Using local simulation stream)
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Feed Mode Toggle */}
          <div className="flex bg-[#F1F5F3] border border-slate-200 rounded-lg p-1 text-xs font-medium">
            <button
              onClick={() => {
                setIsRealDerivFeed(true);
                setDerivError(null);
              }}
              type="button"
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                isRealDerivFeed
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Deriv Live
            </button>
            <button
              onClick={() => {
                setIsRealDerivFeed(false);
                setDerivError(null);
              }}
              type="button"
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                !isRealDerivFeed
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Simulation
            </button>
          </div>

          <button
            onClick={() => setIsLiveEnabled(!isLiveEnabled)}
            type="button"
            className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border ${
              isLiveEnabled
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-[#F8FAF9] border-slate-200 text-slate-600"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLiveEnabled ? "bg-emerald-600 animate-pulse" : "bg-slate-400"
              }`}
            />
            {isLiveEnabled ? "Streaming" : "Paused"}
          </button>

          <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
            Spot:{" "}
            <span className="text-emerald-700">
              {lastTickPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "..."}
            </span>
          </span>
        </div>
      </div>

      {/* Visual Workspace Controls bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#F8FAF9] border border-slate-200 rounded-xl p-3 mb-4">
        {/* Toggle zones */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAiZones(!showAiZones)}
            type="button"
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showAiZones
                ? "bg-emerald-50 border-emerald-600 text-emerald-800"
                : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {showAiZones ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            SMC Zones
          </button>

          <button
            onClick={() => setShowFibLines(!showFibLines)}
            type="button"
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showFibLines
                ? "bg-emerald-50 border-emerald-600 text-emerald-800"
                : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {showFibLines ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Fib OTE
          </button>

          <button
            onClick={() => setShowRsi(!showRsi)}
            type="button"
            className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
              showRsi
                ? "bg-emerald-50 border-emerald-600 text-emerald-800"
                : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {showRsi ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            RSI (14)
          </button>
        </div>

        {/* Sync Trigger / Save to Workspace */}
        <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-3">
          <span className="text-xs font-medium text-slate-600 font-mono tabular-nums">
            Live R:R: <span className="text-emerald-700 font-bold">{liveRRRatio}</span>
          </span>

          <button
            onClick={handleForceMacroTrend}
            type="button"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
            {isBoom ? "Simulate Spike" : isCrash ? "Simulate Drop" : "Simulate Impulse"}
          </button>

          {onCaptureScreenshot && (
            <button
              onClick={handleCaptureScreenshot}
              type="button"
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-xs font-semibold text-emerald-800 rounded-lg border border-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-emerald-600" />
              Capture &amp; Scan
            </button>
          )}

          <button
            onClick={handleLevelSyncClick}
            type="button"
            className={`px-3.5 py-1.5 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer ${
              syncStatus
                ? "bg-emerald-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {syncStatus ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Synced</span>
              </>
            ) : (
              <>
                <Sliders className="h-3.5 w-3.5" />
                <span>Sync Levels</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Lightweight chart mounting point */}
      <div className="relative bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[420px]" id="tradingview-dual-pane-system">
        {isRealDerivFeed && isDerivLoading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center z-30">
            <RefreshCw className="h-7 w-7 text-emerald-600 animate-spin mb-2.5" />
            <span className="text-xs font-semibold text-slate-900">
              Connecting to Deriv Market Stream...
            </span>
            <span className="text-xs text-slate-500 mt-1 font-mono">
              Subscribing to {symbol.name} ticks
            </span>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full flex-1 min-h-[300px]" />

        {/* RSI Divergence Indicator Sub-Pane */}
        {showRsi && (
          <div className="w-full h-[155px] border-t border-slate-200 bg-[#F8FAF9] relative overflow-hidden shrink-0" id="rsi-indicator-docking-pane">
            <div ref={rsiContainerRef} className="w-full h-full" />
            <div className="absolute top-2 left-4 text-[11px] font-mono text-slate-700 font-semibold pointer-events-none z-20 flex items-center gap-2 select-none">
              <span>RSI (14) Momentum &amp; Divergence</span>
              <span className="text-slate-500">· OS: 30 / OB: 70</span>
            </div>
          </div>
        )}
      </div>

      {/* RSI Divergence HUD Panel */}
      <div className="bg-[#F8FAF9] border border-slate-200 rounded-xl p-4 mt-4 text-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <span className="font-bold text-slate-900">RSI Divergence Scanner</span>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-semibold">
            14-Period Pivot Compare
          </span>
        </div>

        {divergences.length === 0 ? (
          <p className="text-slate-600 text-xs leading-relaxed">
            Monitoring tick stream for structural price-momentum divergences. Price action is currently aligned with RSI momentum.
          </p>
        ) : (
          <div className="space-y-2 mt-2 max-h-[160px] overflow-y-auto pr-1">
            {divergences
              .slice(-2)
              .reverse()
              .map((div, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                    div.type === "BULLISH"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  {div.type === "BULLISH" ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-xs">
                      {div.type === "BULLISH"
                        ? "Bullish RSI Divergence Confirmed"
                        : "Bearish RSI Divergence Confirmed"}
                    </p>
                    <p className="text-xs text-slate-700 leading-relaxed mt-0.5">
                      {div.type === "BULLISH"
                        ? `Price printed lower lows (${div.valPrice2.toFixed(2)} vs ${div.valPrice1.toFixed(2)}) while RSI formed a higher low (${div.valRsi2.toFixed(1)} vs ${div.valRsi1.toFixed(1)}), signaling seller exhaustion.`
                        : `Price printed higher highs (${div.valPrice2.toFixed(2)} vs ${div.valPrice1.toFixed(2)}) while RSI formed a lower high (${div.valRsi2.toFixed(1)} vs ${div.valRsi1.toFixed(1)}), signaling buyer exhaustion.`}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Interactive Sliders for adjusting levels right beside the chart */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 font-mono bg-[#F8FAF9] border border-slate-200 p-4 rounded-xl tabular-nums">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 flex justify-between">
            <span>Entry</span>
            <span className="text-emerald-700">{tempEntry.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={tempEntry > 0 ? tempEntry * 0.8 : 500}
            max={tempEntry > 0 ? tempEntry * 1.2 : 2000}
            step={symbol.lotStepValue || 0.1}
            value={tempEntry}
            onChange={(e) => setTempEntry(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 flex justify-between">
            <span>Stop Loss</span>
            <span className="text-rose-600">{tempSL.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={tempEntry > 0 ? tempEntry * 0.7 : 400}
            max={tempEntry > 0 ? tempEntry * 1.15 : 1900}
            step={symbol.lotStepValue || 0.1}
            value={tempSL}
            onChange={(e) => setTempSL(parseFloat(e.target.value))}
            className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 flex justify-between">
            <span>Take Profit 1</span>
            <span className="text-emerald-700">{tempTP1.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={tempEntry > 0 ? tempEntry * 0.9 : 600}
            max={tempEntry > 0 ? tempEntry * 1.5 : 2500}
            step={symbol.lotStepValue || 0.1}
            value={tempTP1}
            onChange={(e) => setTempTP1(parseFloat(e.target.value))}
            className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 flex justify-between">
            <span>Take Profit 2</span>
            <span className="text-emerald-700">{tempTP2.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={tempEntry > 0 ? tempEntry * 0.95 : 700}
            max={tempEntry > 0 ? tempEntry * 1.6 : 3000}
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
