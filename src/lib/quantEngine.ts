import { SyntheticSymbol } from "../data/symbols";
import {
  StandardCandle,
  FuturesTelemetry,
  MultiTimeframeCandles,
  SmtReferenceData,
} from "../services/MarketDataService";

export interface SwingPoint {
  index: number;
  timestamp: number;
  price: number;
  type: "HIGH" | "LOW";
}

export interface FairValueGap {
  type: "BULLISH" | "BEARISH";
  top: number;
  bottom: number;
  midpointCE: number;
  timestamp: number;
  status: "UNMITIGATED" | "PARTIAL_CE" | "MITIGATED" | "INVERSION";
}

export interface OrderBlockZone {
  type: "BULLISH_OB" | "BEARISH_OB" | "BULLISH_BREAKER" | "BEARISH_BREAKER";
  top: number;
  bottom: number;
  open: number;
  timestamp: number;
  status: "FRESH" | "MITIGATED";
  displacementAtrMultiple: number;
}

export interface LiquidityPool {
  label: string;
  kind: "EQH" | "EQL" | "PDH" | "PDL" | "ASIAN_HIGH" | "ASIAN_LOW" | "BSL" | "SSL";
  price: number;
  swept: boolean;
}

export interface TimeframeTrendSummary {
  timeframe: string;
  bias: "BULLISH" | "BEARISH" | "RANGING";
  structureEvent: string;
  dealingHigh: number;
  dealingLow: number;
  equilibrium: number;
  candleCount: number;
  isLiveData: boolean;
}

export interface SmtDivergenceResult {
  checked: boolean;
  referenceName: string | null;
  status: "BULLISH_SMT" | "BEARISH_SMT" | "CORRELATED_CONFIRMED" | "UNAVAILABLE";
  summary: string;
}

export interface SyntheticTelemetryMetrics {
  zScore20: number;
  sma20: number;
  stdDev20: number;
  regime: "EXTREME_OVERBOUGHT" | "EXTREME_OVERSOLD" | "MEAN_REVERTING" | "TRENDING";
  isSpikeAsset: boolean;
  barsSinceLastSpike?: number;
  avgInterSpikeBars?: number;
  compressionRatio?: number;
}

export interface QuantModuleBreakdown {
  id: string;
  moduleNumber: number;
  title: string;
  aligned: boolean;
  score: number;
  maxScore: number;
  summary: string;
  metrics: { label: string; value: string; highlight?: boolean }[];
}

export interface FibonacciMatrix {
  swingLow: number;
  swingHigh: number;
  equilibrium50: number;
  ote618: number;
  ote705SweetSpot: number;
  ote786: number;
  ext1272_TP1: number;
  ext1618_TP2: number;
  ext2000_TP3: number;
  currentZone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM";
  filterPassed: boolean;
  filterExplanation: string;
}

export interface QuantitativeEvaluation {
  symbol: SyntheticSymbol;
  timeframe: string;
  evaluatedAt: string;
  directionalBias: "BULLISH" | "BEARISH" | "NEUTRAL (WAIT FOR LIQUIDITY SWEEP)";
  confluenceScorePct: number; // 0 - 100%
  alignedModulesCount: number; // 0 - 5
  highProbabilityTrigger: boolean; // True when >= 3 of 5 modules align AND R:R >= 2.0
  confluenceFormulaBanner: string;
  modules: QuantModuleBreakdown[];
  fibonacci: FibonacciMatrix;
  smcStructure: {
    htfStructure: string;
    ltfStructure: string;
    structureEvent: "BULLISH_BOS" | "BEARISH_BOS" | "BULLISH_CHOCH" | "BEARISH_CHOCH" | "RANGING";
    pdArrayType: "Order Block (OB)" | "Fair Value Gap (FVG)" | "Breaker Block (BB)" | "Mitigation Block (MB)";
    pdArrayZone: string;
    bslPool: number;
    sslPool: number;
    pdh: number | null;
    pdl: number | null;
    asianHigh: number | null;
    asianLow: number | null;
    liquiditySweepDetected: boolean;
    sweepDescription: string;
    killzoneWindow: string;
    killzoneActive: boolean;
  };
  mtfAlignment: {
    d1: TimeframeTrendSummary;
    h4: TimeframeTrendSummary;
    execution: TimeframeTrendSummary;
    alignedWithHtf: boolean;
    alignmentNote: string;
  };
  overlays: {
    orderBlocks: OrderBlockZone[];
    fairValueGaps: FairValueGap[];
    liquidityPools: LiquidityPool[];
    swings: SwingPoint[];
  };
  smtDivergence: SmtDivergenceResult;
  syntheticMetrics?: SyntheticTelemetryMetrics;
  candlestickTrigger: {
    patternName: string;
    insideHTFPOI: boolean;
    volumeExpansion: boolean;
    filteredOutReason?: string;
    details: string;
  };
  executionCard: {
    orderType: "BUY LIMIT" | "SELL LIMIT" | "WAIT (NO TRIGGER)";
    entryZoneLow: number;
    entryZoneHigh: number;
    optimalEntry705: number;
    invalidationSL: number;
    atrBufferApplied: string;
    tp1_1272: number;
    tp2_1618: number;
    tp3_2000: number;
    riskRewardRatio: string;
    rrNumeric: number;
  };
}

export interface StructuralScanResult {
  symbol: SyntheticSymbol;
  timeframe: string;
  evaluatedAt: string;
  isBullish: boolean;
  rawBias: "BULLISH" | "BEARISH" | "RANGING";
  structureEvent: "BULLISH_BOS" | "BEARISH_BOS" | "BULLISH_CHOCH" | "BEARISH_CHOCH" | "RANGING";
  swingLow: number;
  swingHigh: number;
  swingRange: number;
  equilibrium50: number;
  ote618: number;
  ote705SweetSpot: number;
  ote786: number;
  ext1272_TP1: number;
  ext1618_TP2: number;
  ext2000_TP3: number;
  entryLow: number;
  entryHigh: number;
  optimalEntry: number;
  invalidationSL: number;
  atr: number;
  pdArrayType: "Order Block (OB)" | "Fair Value Gap (FVG)" | "Breaker Block (BB)" | "Mitigation Block (MB)";
  pdArrayZone: string;
  bslPool: number;
  sslPool: number;
  pdh: number | null;
  pdl: number | null;
  asianHigh: number | null;
  asianLow: number | null;
  detectedPattern: string;
  hasStrongCandleTrigger: boolean;
  insideHTFPOI: boolean;
  volumeExpansion: boolean;
  orderBlocks: OrderBlockZone[];
  fairValueGaps: FairValueGap[];
  liquidityPools: LiquidityPool[];
  swings: SwingPoint[];
  mtfAlignment: {
    d1: TimeframeTrendSummary;
    h4: TimeframeTrendSummary;
    execution: TimeframeTrendSummary;
    alignedWithHtf: boolean;
    alignmentNote: string;
  };
  smtDivergence: SmtDivergenceResult;
  syntheticMetrics?: SyntheticTelemetryMetrics;
  priceChange24BarsPct: number;
  killzone: {
    active: boolean;
    windowName: string;
    weightBonus: number;
  };
}

export function formatPrice(price: number, symbol: SyntheticSymbol): string {
  if (!Number.isFinite(price)) return "0.00";
  if (symbol.pointMultiplier >= 10000) return price.toFixed(5);
  if (symbol.pointMultiplier >= 1000) return price.toFixed(3);
  if (symbol.defaultPrice >= 1000) return price.toFixed(2);
  if (symbol.defaultPrice < 2) return price.toFixed(4);
  return price.toFixed(2);
}

export function getNextFundingCountdown(): string {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  const nextFundingHour = Math.ceil((utcHours + 1) / 8) * 8;
  const hoursLeft = (nextFundingHour - utcHours - 1 + 24) % 8;
  const minsLeft = 59 - utcMinutes;
  const secsLeft = 59 - utcSeconds;
  return `${String(hoursLeft).padStart(2, "0")}h ${String(minsLeft).padStart(2, "0")}m ${String(secsLeft).padStart(2, "0")}s`;
}

export function detectActiveICTKillzone(): {
  active: boolean;
  windowName: string;
  weightBonus: number;
} {
  const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyTimeStr);
  const hour = nyDate.getHours();
  const min = nyDate.getMinutes();
  const dec = hour + min / 60;

  if (dec >= 10.0 && dec <= 11.0) {
    return {
      active: true,
      windowName: "ICT NY AM Silver Bullet (10:00–11:00 EST)",
      weightBonus: 1.0,
    };
  }
  if (dec >= 2.0 && dec <= 5.0) {
    return {
      active: true,
      windowName: "ICT London Open Killzone (02:00–05:00 EST)",
      weightBonus: 1.0,
    };
  }
  if (dec >= 7.0 && dec <= 10.0) {
    return {
      active: true,
      windowName: "ICT New York Open Killzone (07:00–10:00 EST)",
      weightBonus: 1.0,
    };
  }
  if (dec >= 14.0 && dec <= 15.0) {
    return {
      active: true,
      windowName: "ICT NY PM Silver Bullet (14:00–15:00 EST)",
      weightBonus: 0.9,
    };
  }
  return {
    active: false,
    windowName: "Inter-Session Consolidation (Outside Killzone)",
    weightBonus: 0.65,
  };
}

// ----------------------------------------------------------------------------
// MATHEMATICAL SMC PRIMITIVES
// ----------------------------------------------------------------------------

function computeATR(candles: StandardCandle[], period: number = 14): number {
  if (!candles || candles.length < 2) return 0;
  const slice = candles.slice(-Math.min(candles.length, period + 1));
  let sum = 0;
  for (let i = 1; i < slice.length; i++) {
    const c = slice[i];
    const prev = slice[i - 1];
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
    sum += tr;
  }
  return sum / Math.max(1, slice.length - 1);
}

// 1. N-bar fractal Swing High / Swing Low detector (default 2 left + 2 right = 5-bar fractal)
export function detectFractalSwings(candles: StandardCandle[], strength: number = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (!candles || candles.length < strength * 2 + 1) return swings;

  for (let i = strength; i < candles.length - strength; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= strength; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high < candles[i + j].high) {
        isHigh = false;
      }
      if (candles[i].low >= candles[i - j].low || candles[i].low > candles[i + j].low) {
        isLow = false;
      }
    }
    if (isHigh) {
      swings.push({ index: i, timestamp: candles[i].timestamp, price: candles[i].high, type: "HIGH" });
    }
    if (isLow) {
      swings.push({ index: i, timestamp: candles[i].timestamp, price: candles[i].low, type: "LOW" });
    }
  }
  return swings;
}

// 2. Real Market Structure State Machine (BOS / CHoCH via candle body closes)
function analyzeMarketStructure(candles: StandardCandle[], swings: SwingPoint[]): {
  bias: "BULLISH" | "BEARISH" | "RANGING";
  structureEvent: "BULLISH_BOS" | "BEARISH_BOS" | "BULLISH_CHOCH" | "BEARISH_CHOCH" | "RANGING";
  dealingHigh: number;
  dealingLow: number;
  lastBosIndex: number;
} {
  if (!candles || candles.length < 10) {
    return { bias: "RANGING", structureEvent: "RANGING", dealingHigh: 0, dealingLow: 0, lastBosIndex: -1 };
  }

  let trend: "BULLISH" | "BEARISH" | "RANGING" = "RANGING";
  let lastEvent: "BULLISH_BOS" | "BEARISH_BOS" | "BULLISH_CHOCH" | "BEARISH_CHOCH" | "RANGING" = "RANGING";
  let activeSwingHigh: SwingPoint | null = null;
  let activeSwingLow: SwingPoint | null = null;
  let lastBosIndex = -1;

  const swingByIdx = new Map<number, SwingPoint[]>();
  for (const s of swings) {
    const arr = swingByIdx.get(s.index) || [];
    arr.push(s);
    swingByIdx.set(s.index, arr);
  }

  for (let i = 0; i < candles.length; i++) {
    // Register swings confirmed 2 bars ago (no look-ahead repainting)
    const confirmedSwings = swingByIdx.get(i - 2);
    if (confirmedSwings) {
      for (const s of confirmedSwings) {
        if (s.type === "HIGH") activeSwingHigh = s;
        if (s.type === "LOW") activeSwingLow = s;
      }
    }

    const c = candles[i];
    if (activeSwingHigh && c.close > activeSwingHigh.price) {
      lastEvent = trend === "BEARISH" ? "BULLISH_CHOCH" : "BULLISH_BOS";
      trend = "BULLISH";
      lastBosIndex = i;
      activeSwingHigh = null; // Consumed; await next swing high
    } else if (activeSwingLow && c.close < activeSwingLow.price) {
      lastEvent = trend === "BULLISH" ? "BEARISH_CHOCH" : "BEARISH_BOS";
      trend = "BEARISH";
      lastBosIndex = i;
      activeSwingLow = null; // Consumed; await next swing low
    }
  }

  // Dealing range anchored to the most recent structural swing highs & lows (last 80 bars)
  const recentHighs = swings.filter((s) => s.type === "HIGH").slice(-4);
  const recentLows = swings.filter((s) => s.type === "LOW").slice(-4);
  const window = candles.slice(-Math.min(candles.length, 80));

  const dealingHigh =
    recentHighs.length > 0
      ? Math.max(...recentHighs.slice(-2).map((s) => s.price))
      : Math.max(...window.map((c) => c.high));
  const dealingLow =
    recentLows.length > 0
      ? Math.min(...recentLows.slice(-2).map((s) => s.price))
      : Math.min(...window.map((c) => c.low));

  return { bias: trend, structureEvent: lastEvent, dealingHigh, dealingLow, lastBosIndex };
}

// 3. Real 3-Candle Fair Value Gap (FVG) Scanner with live mitigation & IFVG tracking
function detectFairValueGaps(candles: StandardCandle[], atr: number): FairValueGap[] {
  const gaps: FairValueGap[] = [];
  if (!candles || candles.length < 5 || atr <= 0) return gaps;

  const startIdx = Math.max(2, candles.length - 100);
  const minGap = atr * 0.15;

  for (let i = startIdx; i < candles.length - 1; i++) {
    const cPrev = candles[i - 2];
    const cNext = candles[i];

    // Bullish FVG (BISI): cPrev.high < cNext.low
    if (cNext.low - cPrev.high >= minGap) {
      const top = cNext.low;
      const bottom = cPrev.high;
      const midpointCE = (top + bottom) / 2;
      let status: FairValueGap["status"] = "UNMITIGATED";

      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].close < bottom) {
          status = "INVERSION";
          break;
        }
        if (candles[k].low <= bottom) {
          status = "MITIGATED";
        } else if (candles[k].low <= midpointCE && status === "UNMITIGATED") {
          status = "PARTIAL_CE";
        }
      }
      gaps.push({ type: "BULLISH", top, bottom, midpointCE, timestamp: candles[i - 1].timestamp, status });
    }

    // Bearish FVG (SIBI): cPrev.low > cNext.high
    if (cPrev.low - cNext.high >= minGap) {
      const top = cPrev.low;
      const bottom = cNext.high;
      const midpointCE = (top + bottom) / 2;
      let status: FairValueGap["status"] = "UNMITIGATED";

      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].close > top) {
          status = "INVERSION";
          break;
        }
        if (candles[k].high >= top) {
          status = "MITIGATED";
        } else if (candles[k].high >= midpointCE && status === "UNMITIGATED") {
          status = "PARTIAL_CE";
        }
      }
      gaps.push({ type: "BEARISH", top, bottom, midpointCE, timestamp: candles[i - 1].timestamp, status });
    }
  }

  return gaps.filter((g) => g.status === "UNMITIGATED" || g.status === "PARTIAL_CE" || g.status === "INVERSION").slice(-6);
}

// 4. Real Order Block (OB) & Breaker Block (BB) Scanner
function detectOrderBlocks(candles: StandardCandle[], atr: number): OrderBlockZone[] {
  const blocks: OrderBlockZone[] = [];
  if (!candles || candles.length < 10 || atr <= 0) return blocks;

  const startIdx = Math.max(3, candles.length - 100);

  for (let i = startIdx; i < candles.length - 1; i++) {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const displacementMultiple = body / atr;

    // Require strong institutional displacement (> 1.35 * ATR)
    if (displacementMultiple < 1.35) continue;

    const isBullishDisp = c.close > c.open;
    // Search up to 3 bars prior for the last opposing candle (OB origin)
    let obCandle: StandardCandle | null = null;
    for (let look = 1; look <= 3; look++) {
      const prev = candles[i - look];
      if (!prev) break;
      if (isBullishDisp && prev.close < prev.open) {
        obCandle = prev;
        break;
      }
      if (!isBullishDisp && prev.close > prev.open) {
        obCandle = prev;
        break;
      }
    }
    if (!obCandle) continue;

    const top = obCandle.high;
    const bottom = obCandle.low;
    let type: OrderBlockZone["type"] = isBullishDisp ? "BULLISH_OB" : "BEARISH_OB";
    let status: OrderBlockZone["status"] = "FRESH";

    // Track mitigation & Breaker promotion
    for (let k = i + 1; k < candles.length; k++) {
      const future = candles[k];
      if (type === "BULLISH_OB") {
        if (future.close < bottom) {
          type = "BEARISH_BREAKER";
          status = "FRESH";
        } else if (future.low <= top) {
          status = "MITIGATED";
        }
      } else if (type === "BEARISH_OB") {
        if (future.close > top) {
          type = "BULLISH_BREAKER";
          status = "FRESH";
        } else if (future.high >= bottom) {
          status = "MITIGATED";
        }
      } else if (type === "BEARISH_BREAKER" && future.high >= bottom) {
        status = "MITIGATED";
      } else if (type === "BULLISH_BREAKER" && future.low <= top) {
        status = "MITIGATED";
      }
    }

    blocks.push({
      type,
      top,
      bottom,
      open: obCandle.open,
      timestamp: obCandle.timestamp,
      status,
      displacementAtrMultiple: Number(displacementMultiple.toFixed(2)),
    });
  }

  // Return up to 4 most recent relevant blocks (prioritizing FRESH ones)
  const fresh = blocks.filter((b) => b.status === "FRESH");
  return (fresh.length > 0 ? fresh : blocks).slice(-4);
}

// 5. Real Liquidity Pools: EQH/EQL + PDH/PDL + Asian High/Low (00:00–05:00 UTC)
function detectLiquidityPools(
  candles: StandardCandle[],
  swings: SwingPoint[],
  atr: number,
  d1Candles?: StandardCandle[]
): {
  pools: LiquidityPool[];
  pdh: number | null;
  pdl: number | null;
  asianHigh: number | null;
  asianLow: number | null;
  bslPool: number;
  sslPool: number;
} {
  const pools: LiquidityPool[] = [];
  const lastCandle = candles[candles.length - 1];
  const recentHighs = swings.filter((s) => s.type === "HIGH").slice(-10);
  const recentLows = swings.filter((s) => s.type === "LOW").slice(-10);
  const eqTol = Math.max(atr * 0.18, 1e-6);

  // Equal Highs (EQH)
  for (let i = 0; i < recentHighs.length; i++) {
    for (let j = i + 1; j < recentHighs.length; j++) {
      if (Math.abs(recentHighs[i].price - recentHighs[j].price) <= eqTol) {
        const level = Math.max(recentHighs[i].price, recentHighs[j].price);
        const swept = lastCandle ? lastCandle.high > level && lastCandle.close < level : false;
        pools.push({ label: "Equal Highs (EQH)", kind: "EQH", price: level, swept });
        break;
      }
    }
  }

  // Equal Lows (EQL)
  for (let i = 0; i < recentLows.length; i++) {
    for (let j = i + 1; j < recentLows.length; j++) {
      if (Math.abs(recentLows[i].price - recentLows[j].price) <= eqTol) {
        const level = Math.min(recentLows[i].price, recentLows[j].price);
        const swept = lastCandle ? lastCandle.low < level && lastCandle.close > level : false;
        pools.push({ label: "Equal Lows (EQL)", kind: "EQL", price: level, swept });
        break;
      }
    }
  }

  // PDH / PDL from real D1 candles (previous completed day)
  let pdh: number | null = null;
  let pdl: number | null = null;
  if (d1Candles && d1Candles.length >= 2) {
    const prevDay = d1Candles[d1Candles.length - 2];
    pdh = prevDay.high;
    pdl = prevDay.low;
    pools.push({
      label: "Prev Day High (PDH)",
      kind: "PDH",
      price: pdh,
      swept: lastCandle ? lastCandle.high > pdh && lastCandle.close < pdh : false,
    });
    pools.push({
      label: "Prev Day Low (PDL)",
      kind: "PDL",
      price: pdl,
      swept: lastCandle ? lastCandle.low < pdl && lastCandle.close > pdl : false,
    });
  }

  // Asian Session High / Low (00:00 - 05:00 UTC of most recent UTC day present in candles)
  let asianHigh: number | null = null;
  let asianLow: number | null = null;
  if (candles.length > 0) {
    const latestDayStr = new Date(candles[candles.length - 1].timestamp * 1000).toISOString().slice(0, 10);
    const asianBars = candles.filter((c) => {
      const dt = new Date(c.timestamp * 1000);
      const dayStr = dt.toISOString().slice(0, 10);
      const utcH = dt.getUTCHours();
      return dayStr === latestDayStr && utcH >= 0 && utcH < 5;
    });
    if (asianBars.length >= 2) {
      asianHigh = Math.max(...asianBars.map((c) => c.high));
      asianLow = Math.min(...asianBars.map((c) => c.low));
      pools.push({
        label: "Asian High",
        kind: "ASIAN_HIGH",
        price: asianHigh,
        swept: lastCandle ? lastCandle.high > asianHigh && lastCandle.close < asianHigh : false,
      });
      pools.push({
        label: "Asian Low",
        kind: "ASIAN_LOW",
        price: asianLow,
        swept: lastCandle ? lastCandle.low < asianLow && lastCandle.close > asianLow : false,
      });
    }
  }

  const fallbackHigh = recentHighs.length > 0 ? recentHighs[recentHighs.length - 1].price : (lastCandle?.high || 0);
  const fallbackLow = recentLows.length > 0 ? recentLows[recentLows.length - 1].price : (lastCandle?.low || 0);

  const bslPool = pdh ?? (pools.find((p) => p.kind === "EQH")?.price ?? fallbackHigh);
  const sslPool = pdl ?? (pools.find((p) => p.kind === "EQL")?.price ?? fallbackLow);

  // Deduplicate close pool levels
  const deduped = pools.slice(-6);
  return { pools: deduped, pdh, pdl, asianHigh, asianLow, bslPool, sslPool };
}

// 6. Real MTF Single-Timeframe Trend Evaluator
function summarizeTimeframe(candles: StandardCandle[] | undefined, tfLabel: string): TimeframeTrendSummary {
  if (!candles || candles.length < 12) {
    return {
      timeframe: tfLabel,
      bias: "RANGING",
      structureEvent: "Awaiting HTF Candles",
      dealingHigh: 0,
      dealingLow: 0,
      equilibrium: 0,
      candleCount: candles?.length || 0,
      isLiveData: false,
    };
  }
  const swings = detectFractalSwings(candles, 2);
  const ms = analyzeMarketStructure(candles, swings);
  const eventLabels: Record<typeof ms.structureEvent, string> = {
    BULLISH_BOS: "Bullish BOS (Continuation)",
    BEARISH_BOS: "Bearish BOS (Continuation)",
    BULLISH_CHOCH: "Bullish CHoCH / MSS",
    BEARISH_CHOCH: "Bearish CHoCH / MSS",
    RANGING: "Consolidation / Internal Range",
  };
  return {
    timeframe: tfLabel,
    bias: ms.bias,
    structureEvent: eventLabels[ms.structureEvent],
    dealingHigh: ms.dealingHigh,
    dealingLow: ms.dealingLow,
    equilibrium: (ms.dealingHigh + ms.dealingLow) / 2,
    candleCount: candles.length,
    isLiveData: true,
  };
}

// 7. Real Paired SMT Divergence Calculator
function computeSmtDivergence(
  primaryCandles: StandardCandle[],
  smtReference?: SmtReferenceData | null
): SmtDivergenceResult {
  if (!smtReference || smtReference.candles.length < 15 || primaryCandles.length < 15) {
    return {
      checked: false,
      referenceName: smtReference?.referenceName || null,
      status: "UNAVAILABLE",
      summary: "Paired correlated feed unavailable for this instrument.",
    };
  }

  const pSwings = detectFractalSwings(primaryCandles.slice(-60), 2);
  const rSwings = detectFractalSwings(smtReference.candles.slice(-60), 2);

  const pHighs = pSwings.filter((s) => s.type === "HIGH").slice(-2);
  const pLows = pSwings.filter((s) => s.type === "LOW").slice(-2);
  const rHighs = rSwings.filter((s) => s.type === "HIGH").slice(-2);
  const rLows = rSwings.filter((s) => s.type === "LOW").slice(-2);

  if (smtReference.correlationType === "POSITIVE") {
    if (pHighs.length === 2 && rHighs.length === 2) {
      const primaryHH = pHighs[1].price > pHighs[0].price;
      const refLH = rHighs[1].price < rHighs[0].price;
      if (primaryHH && refLH) {
        return {
          checked: true,
          referenceName: smtReference.referenceName,
          status: "BEARISH_SMT",
          summary: `Bearish SMT Crack: Primary printed Higher High while ${smtReference.referenceName} failed with Lower High (institutional distribution).`,
        };
      }
    }
    if (pLows.length === 2 && rLows.length === 2) {
      const primaryLL = pLows[1].price < pLows[0].price;
      const refHL = rLows[1].price > rLows[0].price;
      if (primaryLL && refHL) {
        return {
          checked: true,
          referenceName: smtReference.referenceName,
          status: "BULLISH_SMT",
          summary: `Bullish SMT Crack: Primary swept Lower Low while ${smtReference.referenceName} held Higher Low (institutional accumulation).`,
        };
      }
    }
  } else {
    // INVERSE correlation (e.g. USDCHF vs EURUSD)
    if (pHighs.length === 2 && rLows.length === 2) {
      const primaryHH = pHighs[1].price > pHighs[0].price;
      const refHL = rLows[1].price > rLows[0].price; // Failed to make inverse Lower Low
      if (primaryHH && refHL) {
        return {
          checked: true,
          referenceName: smtReference.referenceName,
          status: "BEARISH_SMT",
          summary: `Bearish Inverse SMT vs ${smtReference.referenceName}: Primary pushed HH while inverse benchmark refused to print LL.`,
        };
      }
    }
    if (pLows.length === 2 && rHighs.length === 2) {
      const primaryLL = pLows[1].price < pLows[0].price;
      const refLH = rHighs[1].price < rHighs[0].price;
      if (primaryLL && refLH) {
        return {
          checked: true,
          referenceName: smtReference.referenceName,
          status: "BULLISH_SMT",
          summary: `Bullish Inverse SMT vs ${smtReference.referenceName}: Primary swept LL while inverse benchmark failed to print HH.`,
        };
      }
    }
  }

  return {
    checked: true,
    referenceName: smtReference.referenceName,
    status: "CORRELATED_CONFIRMED",
    summary: `Aligned symmetrically with ${smtReference.referenceName} (${smtReference.correlationType.toLowerCase()} correlation intact).`,
  };
}

// 8. Real Synthetic Metrics: 20-period Z-Score + Boom/Crash Spike Interval & Compression
function computeSyntheticMetrics(
  candles: StandardCandle[],
  symbol: SyntheticSymbol
): SyntheticTelemetryMetrics {
  const isSpikeAsset =
    symbol.subCategory === "Spike" ||
    symbol.ticker.startsWith("B") ||
    symbol.ticker.startsWith("C");

  if (!candles || candles.length < 20) {
    return {
      zScore20: 0,
      sma20: symbol.defaultPrice,
      stdDev20: symbol.atrDefault || 1,
      regime: "TRENDING",
      isSpikeAsset,
    };
  }

  const last20 = candles.slice(-20);
  const closes = last20.map((c) => c.close);
  const sma20 = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((acc, v) => acc + Math.pow(v - sma20, 2), 0) / closes.length;
  const stdDev20 = Math.sqrt(variance) || 1e-6;
  const latestClose = closes[closes.length - 1];
  const zScore20 = Number(((latestClose - sma20) / stdDev20).toFixed(2));

  let regime: SyntheticTelemetryMetrics["regime"] = "TRENDING";
  if (zScore20 >= 2.0) regime = "EXTREME_OVERBOUGHT";
  else if (zScore20 <= -2.0) regime = "EXTREME_OVERSOLD";
  else if (Math.abs(zScore20) <= 0.75) regime = "MEAN_REVERTING";

  if (!isSpikeAsset) {
    return { zScore20, sma20, stdDev20, regime, isSpikeAsset };
  }

  // Boom/Crash Spike Detection: candle range > 2.6 * median candle range
  const window = candles.slice(-120);
  const ranges = window.map((c) => c.high - c.low).sort((a, b) => a - b);
  const medianRange = ranges[Math.floor(ranges.length / 2)] || 1e-6;
  const spikeIndices: number[] = [];
  window.forEach((c, idx) => {
    if (c.high - c.low >= medianRange * 2.6) {
      spikeIndices.push(idx);
    }
  });

  const barsSinceLastSpike =
    spikeIndices.length > 0 ? window.length - 1 - spikeIndices[spikeIndices.length - 1] : window.length;

  let avgInterSpikeBars = 18;
  if (spikeIndices.length >= 2) {
    let diffSum = 0;
    for (let i = 1; i < spikeIndices.length; i++) {
      diffSum += spikeIndices[i] - spikeIndices[i - 1];
    }
    avgInterSpikeBars = Math.round(diffSum / (spikeIndices.length - 1));
  }

  const last5AvgRange =
    window.slice(-5).reduce((s, c) => s + (c.high - c.low), 0) / Math.min(5, window.length);
  const compressionRatio = Number((last5AvgRange / medianRange).toFixed(2));

  return {
    zScore20,
    sma20,
    stdDev20,
    regime,
    isSpikeAsset: true,
    barsSinceLastSpike,
    avgInterSpikeBars,
    compressionRatio,
  };
}

// ----------------------------------------------------------------------------
// TIER 1: Heavy Structural Scan (Run on Closed Candles + Real MTF + Real SMT)
// ----------------------------------------------------------------------------
export function evaluateStructuralScan(
  candles: StandardCandle[],
  symbol: SyntheticSymbol,
  timeframe: string = "H1",
  aiResult?: any,
  mtfCandles?: MultiTimeframeCandles | null,
  smtReference?: SmtReferenceData | null
): StructuralScanResult {
  const killzone = detectActiveICTKillzone();
  const closedCandles = candles && candles.length > 5 ? candles : [];
  const basePrice =
    closedCandles.length > 0
      ? closedCandles[closedCandles.length - 1].close
      : aiResult?.tradeSetup?.entry || symbol.defaultPrice;

  const computedAtr = computeATR(closedCandles, 14);
  const atr = computedAtr > 0 ? computedAtr : symbol.atrDefault || basePrice * 0.008;

  // 1. Real Swings & Market Structure
  const swings = detectFractalSwings(closedCandles, 2);
  const ms = analyzeMarketStructure(closedCandles, swings);

  // 2. Real MTF Top-Down Analysis
  const d1Summary = summarizeTimeframe(mtfCandles?.d1, "1D");
  const h4Summary = summarizeTimeframe(mtfCandles?.h4, "4H");
  const execSummary = summarizeTimeframe(closedCandles, timeframe);

  // Determine structural bias (preferring confirmed execution BOS/CHoCH, falling back to H4/D1 when ranging)
  let rawBias: "BULLISH" | "BEARISH" | "RANGING" = ms.bias;
  if (rawBias === "RANGING") {
    if (h4Summary.isLiveData && h4Summary.bias !== "RANGING") rawBias = h4Summary.bias;
    else if (d1Summary.isLiveData && d1Summary.bias !== "RANGING") rawBias = d1Summary.bias;
  }

  const isBullish =
    rawBias === "BULLISH"
      ? true
      : rawBias === "BEARISH"
      ? false
      : closedCandles.length >= 20
      ? closedCandles[closedCandles.length - 1].close >= closedCandles[closedCandles.length - 20].close
      : !symbol.ticker.startsWith("C");

  // Check real MTF HTF alignment
  const htfDirections = [d1Summary, h4Summary].filter((t) => t.isLiveData && t.bias !== "RANGING");
  const alignedWithHtf =
    htfDirections.length === 0
      ? rawBias !== "RANGING"
      : htfDirections.some((t) => t.bias === (isBullish ? "BULLISH" : "BEARISH"));

  const alignmentNote =
    htfDirections.length === 0
      ? "HTF candles syncing — scoring execution structure."
      : alignedWithHtf
      ? `Execution ${isBullish ? "Long" : "Short"} aligns with HTF (${d1Summary.bias} 1D / ${h4Summary.bias} 4H).`
      : `Counter-trend caution: Execution ${isBullish ? "Long" : "Short"} opposes HTF (${d1Summary.bias} 1D / ${h4Summary.bias} 4H).`;

  // 3. Real FVGs, Order Blocks, and Liquidity Pools
  const fairValueGaps = detectFairValueGaps(closedCandles, atr);
  const orderBlocks = detectOrderBlocks(closedCandles, atr);
  const liq = detectLiquidityPools(closedCandles, swings, atr, mtfCandles?.d1);

  // Dealing range from confirmed structural swings
  const swingLow = ms.dealingLow > 0 ? ms.dealingLow : basePrice - atr * 2.5;
  const swingHigh = ms.dealingHigh > swingLow ? ms.dealingHigh : swingLow + atr * 4.0;
  const swingRange = Math.max(swingHigh - swingLow, atr * 1.8);

  const equilibrium50 = swingLow + swingRange * 0.5;
  const ote618 = isBullish ? swingHigh - swingRange * 0.618 : swingLow + swingRange * 0.618;
  const ote705SweetSpot = isBullish ? swingHigh - swingRange * 0.705 : swingLow + swingRange * 0.705;
  const ote786 = isBullish ? swingHigh - swingRange * 0.786 : swingLow + swingRange * 0.786;

  const ext1272_TP1 = isBullish ? swingLow + swingRange * 1.272 : swingHigh - swingRange * 1.272;
  const ext1618_TP2 = isBullish ? swingLow + swingRange * 1.618 : swingHigh - swingRange * 1.618;
  const ext2000_TP3 = isBullish ? swingLow + swingRange * 2.0 : swingHigh - swingRange * 2.0;

  // Select best directional PD Array (Fresh OB -> Unmitigated FVG -> Breaker -> OTE Zone)
  const matchingOb = [...orderBlocks]
    .reverse()
    .find((b) =>
      isBullish
        ? b.type === "BULLISH_OB" || b.type === "BULLISH_BREAKER"
        : b.type === "BEARISH_OB" || b.type === "BEARISH_BREAKER"
    );
  const matchingFvg = [...fairValueGaps]
    .reverse()
    .find((g) => (isBullish ? g.type === "BULLISH" : g.type === "BEARISH"));

  let pdArrayType: StructuralScanResult["pdArrayType"] = "Order Block (OB)";
  let entryLow = Math.min(ote618, ote786);
  let entryHigh = Math.max(ote618, ote786);
  let optimalEntry = ote705SweetSpot;

  if (matchingOb) {
    pdArrayType = matchingOb.type.includes("BREAKER") ? "Breaker Block (BB)" : "Order Block (OB)";
    entryLow = matchingOb.bottom;
    entryHigh = matchingOb.top;
    // Anchor optimal entry inside OB or midpoint blended with OTE if OB is in discount/premium
    const obMid = (matchingOb.top + matchingOb.bottom) / 2;
    const obInCorrectZone = isBullish ? obMid <= equilibrium50 : obMid >= equilibrium50;
    optimalEntry = obInCorrectZone ? obMid : ote705SweetSpot;
  } else if (matchingFvg) {
    pdArrayType = "Fair Value Gap (FVG)";
    entryLow = matchingFvg.bottom;
    entryHigh = matchingFvg.top;
    const fvgInCorrectZone = isBullish ? matchingFvg.midpointCE <= equilibrium50 : matchingFvg.midpointCE >= equilibrium50;
    optimalEntry = fvgInCorrectZone ? matchingFvg.midpointCE : ote705SweetSpot;
  }

  const pdArrayZone = `${formatPrice(entryLow, symbol)} – ${formatPrice(entryHigh, symbol)}`;

  // Anti-SL Hunting Structural Invalidation: strictly beyond OB/Swing extreme + 0.35 ATR buffer
  const structuralFloor = matchingOb ? Math.min(matchingOb.bottom, swingLow) : swingLow;
  const structuralCeiling = matchingOb ? Math.max(matchingOb.top, swingHigh) : swingHigh;
  const invalidationSL = isBullish ? structuralFloor - atr * 0.35 : structuralCeiling + atr * 0.35;

  // 4. Real Candlestick Pattern & Volume Expansion Detection on Closed Candles
  let detectedPattern = "No Confirmed Reversal Candle Yet";
  let hasStrongCandleTrigger = false;
  let volumeExpansion = false;

  if (closedCandles.length >= 6) {
    const c1 = closedCandles[closedCandles.length - 2]; // Last closed candle
    const c2 = closedCandles[closedCandles.length - 3];
    const body = Math.abs(c1.close - c1.open);
    const range = Math.max(c1.high - c1.low, 1e-8);
    const upperWick = c1.high - Math.max(c1.open, c1.close);
    const lowerWick = Math.min(c1.open, c1.close) - c1.low;

    const avgVol =
      closedCandles.slice(-22, -2).reduce((sum, c) => sum + c.volume, 0) / 20;
    volumeExpansion = avgVol > 0 ? c1.volume > avgVol * 1.15 : range > atr * 1.15;

    if (lowerWick > body * 1.6 && lowerWick > upperWick * 1.8 && isBullish) {
      detectedPattern = "Bullish Liquidity Sweep Pin Bar (Hammer)";
      hasStrongCandleTrigger = true;
    } else if (upperWick > body * 1.6 && upperWick > lowerWick * 1.8 && !isBullish) {
      detectedPattern = "Bearish Liquidity Sweep Shooting Star";
      hasStrongCandleTrigger = true;
    } else if (c1.close > c2.open && c1.open <= c2.close && c1.close > c1.open && body > atr * 0.65 && isBullish) {
      detectedPattern = "Bullish Engulfing Displacement Candle";
      hasStrongCandleTrigger = true;
    } else if (c1.close < c2.open && c1.open >= c2.close && c1.close < c1.open && body > atr * 0.65 && !isBullish) {
      detectedPattern = "Bearish Engulfing Displacement Candle";
      hasStrongCandleTrigger = true;
    } else if (body > atr * 1.35 && ((isBullish && c1.close > c1.open) || (!isBullish && c1.close < c1.open))) {
      detectedPattern = isBullish ? "Bullish Institutional Displacement Bar" : "Bearish Institutional Displacement Bar";
      hasStrongCandleTrigger = true;
    }
  }

  const insideHTFPOI =
    (isBullish && basePrice <= equilibrium50 && basePrice >= swingLow - atr * 0.5) ||
    (!isBullish && basePrice >= equilibrium50 && basePrice <= swingHigh + atr * 0.5);

  // 5. Real Paired SMT & Synthetic Quantitative Telemetry
  const smtDivergence = computeSmtDivergence(closedCandles, smtReference);
  const syntheticMetrics =
    symbol.marketType === "SYNTHETIC" ? computeSyntheticMetrics(closedCandles, symbol) : undefined;

  const refIdx = Math.max(0, closedCandles.length - 25);
  const priceChange24BarsPct =
    closedCandles.length > 5 && closedCandles[refIdx].close > 0
      ? Number((((basePrice - closedCandles[refIdx].close) / closedCandles[refIdx].close) * 100).toFixed(2))
      : 0;

  return {
    symbol,
    timeframe,
    evaluatedAt: new Date().toISOString(),
    isBullish,
    rawBias,
    structureEvent: ms.structureEvent,
    swingLow,
    swingHigh,
    swingRange,
    equilibrium50,
    ote618,
    ote705SweetSpot,
    ote786,
    ext1272_TP1,
    ext1618_TP2,
    ext2000_TP3,
    entryLow,
    entryHigh,
    optimalEntry,
    invalidationSL,
    atr,
    pdArrayType,
    pdArrayZone,
    bslPool: liq.bslPool || swingHigh,
    sslPool: liq.sslPool || swingLow,
    pdh: liq.pdh,
    pdl: liq.pdl,
    asianHigh: liq.asianHigh,
    asianLow: liq.asianLow,
    detectedPattern,
    hasStrongCandleTrigger,
    insideHTFPOI,
    volumeExpansion,
    orderBlocks,
    fairValueGaps,
    liquidityPools: liq.pools,
    swings: swings.slice(-12),
    mtfAlignment: {
      d1: d1Summary,
      h4: h4Summary,
      execution: execSummary,
      alignedWithHtf,
      alignmentNote,
    },
    smtDivergence,
    syntheticMetrics,
    priceChange24BarsPct,
    killzone,
  };
}

// ----------------------------------------------------------------------------
// TIER 2: Lightweight Live-Tick Monitor (Strict Anti-Repaint & Honest Scoring)
// ----------------------------------------------------------------------------
export function evaluateLiveTick(
  liveCandle: StandardCandle,
  structural: StructuralScanResult,
  futuresTelemetry?: FuturesTelemetry | null
): QuantitativeEvaluation {
  const { symbol, timeframe, isBullish, killzone, pdArrayType, pdArrayZone } = structural;
  const currentPrice = liveCandle.close;

  // 1. Live Liquidity Sweep Detection (wick pierces SSL/BSL or PDH/PDL/Asian pool and rejects)
  const isSweepSSL =
    liveCandle.low <= structural.sslPool ||
    (structural.pdl !== null && liveCandle.low <= structural.pdl) ||
    (structural.asianLow !== null && liveCandle.low <= structural.asianLow);
  const isSweepBSL =
    liveCandle.high >= structural.bslPool ||
    (structural.pdh !== null && liveCandle.high >= structural.pdh) ||
    (structural.asianHigh !== null && liveCandle.high >= structural.asianHigh);
  const anyPriorPoolSwept = structural.liquidityPools.some((p) => p.swept);
  const dynamicSweepActive = (isBullish ? isSweepSSL : isSweepBSL) || anyPriorPoolSwept;

  // 2. Premium vs Discount Zone check on live price
  const isInsideDiscount = currentPrice < structural.equilibrium50;
  const isInsidePremium = currentPrice > structural.equilibrium50;
  const isInsideEntryZone = currentPrice >= structural.entryLow && currentPrice <= structural.entryHigh;
  const isNearOte =
    Math.abs(currentPrice - structural.ote705SweetSpot) <= structural.atr * 1.25;

  const currentZone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM" = isInsideDiscount
    ? "DISCOUNT"
    : isInsidePremium
    ? "PREMIUM"
    : "EQUILIBRIUM";

  const fibFilterPassed = (isBullish && isInsideDiscount) || (!isBullish && isInsidePremium);

  // Module 1: SMC / ICT Structure + MTF Alignment + Real PD Arrays (Max 25)
  const hasRealStructure = structural.structureEvent !== "RANGING";
  const hasPdArray = structural.orderBlocks.length > 0 || structural.fairValueGaps.length > 0;
  const mod1Aligned = hasRealStructure && (structural.mtfAlignment.alignedWithHtf || dynamicSweepActive);
  let mod1Score = 6;
  if (hasRealStructure) mod1Score += 7;
  if (structural.mtfAlignment.alignedWithHtf) mod1Score += 5;
  if (hasPdArray) mod1Score += 4;
  if (dynamicSweepActive) mod1Score += 3;
  mod1Score = Math.min(25, mod1Score);

  // Module 2: Fibonacci OTE & Discount/Premium Filter (Max 25)
  const mod2Score = fibFilterPassed
    ? isInsideEntryZone
      ? 25
      : isNearOte
      ? 21
      : 17
    : 8;

  // Module 3: Candlestick Trigger localized at POI (Max 15)
  const mod3Aligned = (structural.hasStrongCandleTrigger || isInsideEntryZone) && fibFilterPassed;
  const mod3Score = mod3Aligned ? (structural.volumeExpansion ? 15 : 12) : structural.hasStrongCandleTrigger ? 8 : 5;

  // Module 4: Real Asset-Specific Quantitative Microstructure (Max 20) — NO HARDCODED TRUE!
  let mod4Aligned = false;
  let mod4Score = 8;
  let mod4Summary = "";
  let mod4Metrics: { label: string; value: string; highlight?: boolean }[] = [];

  if (symbol.marketType === "CRYPTO_PERP") {
    const funding = futuresTelemetry?.fundingRate ?? 0.0001;
    const fundingPctStr = `${(funding * 100).toFixed(4)}%`;
    const oiUsd =
      futuresTelemetry && futuresTelemetry.openInterestValue > 0
        ? `$${(futuresTelemetry.openInterestValue / 1e9).toFixed(2)}B`
        : symbol.futuresMetrics?.openInterestUsd || "Syncing...";
    const oiDelta = futuresTelemetry?.oiDeltaPct24h;
    const cvdBias = futuresTelemetry?.cvdBias || "NEUTRAL";

    // 4-Quadrant OI + Price Matrix
    let oiRegime = "Neutral Positioning";
    let oiFavorsBias = false;
    if (oiDelta !== undefined) {
      if (oiDelta > 0.5 && structural.priceChange24BarsPct > 0) {
        oiRegime = "Long Buildup (OI↑ Price↑)";
        oiFavorsBias = isBullish;
      } else if (oiDelta > 0.5 && structural.priceChange24BarsPct < 0) {
        oiRegime = "Short Buildup (OI↑ Price↓)";
        oiFavorsBias = !isBullish;
      } else if (oiDelta < -0.5 && structural.priceChange24BarsPct < 0) {
        oiRegime = "Long Liquidation Flush (OI↓ Price↓)";
        oiFavorsBias = isBullish; // Exhaustion flush favors reversal long
      } else if (oiDelta < -0.5 && structural.priceChange24BarsPct > 0) {
        oiRegime = "Short Squeeze Covering (OI↓ Price↑)";
        oiFavorsBias = isBullish;
      }
    }

    const fundingFavorsBias = isBullish ? funding <= 0.00025 : funding >= -0.0001;
    const cvdFavorsBias =
      (isBullish && cvdBias === "BULLISH_ABSORPTION") ||
      (!isBullish && cvdBias === "BEARISH_DISTRIBUTION");

    const passCount = [oiFavorsBias, fundingFavorsBias, cvdFavorsBias].filter(Boolean).length;
    mod4Aligned = passCount >= 2;
    mod4Score = 6 + passCount * 4 + (oiDelta !== undefined ? 2 : 0);
    mod4Score = Math.min(20, mod4Score);

    mod4Summary = `Bybit V5 Orderflow: ${oiRegime}. Funding ${fundingPctStr} · CVD ${cvdBias.replace("_", " ")}.`;
    mod4Metrics = [
      { label: "Live Funding Rate (8h)", value: fundingPctStr, highlight: fundingFavorsBias },
      { label: "Open Interest & 24h Δ", value: `${oiUsd} (${oiDelta !== undefined ? `${oiDelta > 0 ? "+" : ""}${oiDelta}%` : "Live"})`, highlight: oiFavorsBias },
      { label: "OI / Price Quadrant", value: oiRegime, highlight: oiFavorsBias },
      { label: "Live Tape CVD Bias", value: cvdBias.replace("_", " "), highlight: cvdFavorsBias },
    ];
  } else if (symbol.marketType === "SYNTHETIC") {
    const sm = structural.syntheticMetrics;
    const zScore = sm?.zScore20 ?? 0;

    if (sm?.isSpikeAsset) {
      const barsSince = sm.barsSinceLastSpike ?? 0;
      const avgInterval = sm.avgInterSpikeBars ?? 18;
      const compression = sm.compressionRatio ?? 1.0;
      const spikeDue = barsSince >= avgInterval * 0.75;
      const compressed = compression <= 0.85;
      mod4Aligned = spikeDue || compressed;
      mod4Score = 8 + (spikeDue ? 6 : 0) + (compressed ? 6 : 0);

      mod4Summary = `Boom/Crash Spike Telemetry: ${barsSince} bars since last spike (avg ${avgInterval} bars), compression ratio ${compression}x.`;
      mod4Metrics = [
        { label: "Bars Since Last Spike", value: `${barsSince} bars (Avg ${avgInterval})`, highlight: spikeDue },
        { label: "Pre-Spike Compression", value: `${compression}x median range`, highlight: compressed },
        { label: "20-Bar Z-Score", value: `${zScore > 0 ? "+" : ""}${zScore}σ`, highlight: Math.abs(zScore) >= 1.8 },
        { label: "Engine Regime", value: spikeDue && compressed ? "Pre-Spike Base Ready" : "Standard Tick Drift" },
      ];
    } else {
      const meanRevEdge = (isBullish && zScore <= -1.2) || (!isBullish && zScore >= 1.2);
      const trendEdge = (isBullish && zScore > 0 && zScore < 2.2) || (!isBullish && zScore < 0 && zScore > -2.2);
      mod4Aligned = meanRevEdge || trendEdge;
      mod4Score = meanRevEdge ? 19 : trendEdge ? 15 : 8;

      mod4Summary = `Volatility Z-Score Engine: Price at ${zScore > 0 ? "+" : ""}${zScore}σ vs 20-period mean (${formatPrice(sm?.sma20 || currentPrice, symbol)}). Regime: ${sm?.regime || "TRENDING"}.`;
      mod4Metrics = [
        { label: "20-Bar Z-Score", value: `${zScore > 0 ? "+" : ""}${zScore}σ`, highlight: Math.abs(zScore) >= 1.5 },
        { label: "Statistical Regime", value: (sm?.regime || "TRENDING").replace("_", " "), highlight: meanRevEdge },
        { label: "Volatility Profile", value: symbol.syntheticProfile?.constantVolatilityPct || "24/7 Constant Variance" },
        { label: "ATR (14)", value: formatPrice(structural.atr, symbol) },
      ];
    }
  } else {
    // FOREX, METALS & GLOBAL INDICES: Real Paired SMT Divergence + ICT Killzone + Asian Sweep
    const smt = structural.smtDivergence;
    const smtAligned =
      (isBullish && smt.status === "BULLISH_SMT") ||
      (!isBullish && smt.status === "BEARISH_SMT");
    const asianSweptAligned =
      (isBullish && structural.asianLow !== null && liveCandle.low <= structural.asianLow) ||
      (!isBullish && structural.asianHigh !== null && liveCandle.high >= structural.asianHigh);

    mod4Aligned = smtAligned || killzone.active || asianSweptAligned;
    mod4Score = 8 + (killzone.active ? 6 : 0) + (smtAligned ? 6 : smt.status === "CORRELATED_CONFIRMED" ? 3 : 0) + (asianSweptAligned ? 3 : 0);
    mod4Score = Math.min(20, mod4Score);

    mod4Summary = `${smt.summary} Active Session: ${killzone.windowName}.`;
    mod4Metrics = [
      { label: `SMT vs ${smt.referenceName || "Benchmark"}`, value: smt.status.replace(/_/g, " "), highlight: smtAligned },
      { label: "ICT Killzone Window", value: killzone.active ? killzone.windowName : "Outside Killzone", highlight: killzone.active },
      {
        label: "Asian Range (00-05 UTC)",
        value:
          structural.asianHigh && structural.asianLow
            ? `${formatPrice(structural.asianLow, symbol)} – ${formatPrice(structural.asianHigh, symbol)}`
            : "Building / Intraday",
        highlight: asianSweptAligned,
      },
      { label: "ATR (14) Volatility", value: formatPrice(structural.atr, symbol) },
    ];
  }

  // Module 5: Honest Risk-to-Reward & Execution Filter (NO FAKE 2.5 CLAMP!)
  const actualRisk = Math.abs(structural.optimalEntry - structural.invalidationSL);
  const rewardTP2 = Math.abs(structural.ext1618_TP2 - structural.optimalEntry);
  const rawRR = actualRisk > 0 ? rewardTP2 / actualRisk : 0;
  const rrNumeric = Number(Math.max(0.1, rawRR).toFixed(2));
  const mod5Aligned = rrNumeric >= 2.0;
  const mod5Score = rrNumeric >= 2.5 ? 15 : rrNumeric >= 2.0 ? 12 : 5;

  const structureEventLabelMap: Record<StructuralScanResult["structureEvent"], string> = {
    BULLISH_BOS: "Bullish BOS",
    BEARISH_BOS: "Bearish BOS",
    BULLISH_CHOCH: "Bullish CHoCH / MSS",
    BEARISH_CHOCH: "Bearish CHoCH / MSS",
    RANGING: "Ranging / No Break",
  };

  const modules: QuantModuleBreakdown[] = [
    {
      id: "smc-ict",
      moduleNumber: 1,
      title: "Smart Money Concepts (SMC) & MTF Structure",
      aligned: mod1Aligned,
      score: mod1Score,
      maxScore: 25,
      summary: `${structureEventLabelMap[structural.structureEvent]} detected on ${timeframe}. ${structural.mtfAlignment.alignmentNote}`,
      metrics: [
        { label: `Execution (${timeframe}) Event`, value: structureEventLabelMap[structural.structureEvent], highlight: hasRealStructure },
        { label: "HTF Alignment (1D / 4H)", value: `${structural.mtfAlignment.d1.bias} / ${structural.mtfAlignment.h4.bias}`, highlight: structural.mtfAlignment.alignedWithHtf },
        { label: "Primary PD Array", value: `${pdArrayType} (${structural.orderBlocks.length} OB · ${structural.fairValueGaps.length} FVG)` },
        { label: "BSL / SSL Liquidity", value: `${formatPrice(structural.bslPool, symbol)} / ${formatPrice(structural.sslPool, symbol)}`, highlight: dynamicSweepActive },
      ],
    },
    {
      id: "fib-ote",
      moduleNumber: 2,
      title: "Fibonacci Dealing Range & 0.705 OTE",
      aligned: fibFilterPassed,
      score: mod2Score,
      maxScore: 25,
      summary: fibFilterPassed
        ? isBullish
          ? `Price in Discount (< 50% EQ at ${formatPrice(structural.equilibrium50, symbol)}). OTE 0.705 anchored at ${formatPrice(structural.ote705SweetSpot, symbol)}.`
          : `Price in Premium (> 50% EQ at ${formatPrice(structural.equilibrium50, symbol)}). OTE 0.705 anchored at ${formatPrice(structural.ote705SweetSpot, symbol)}.`
        : `Price is currently in ${currentZone} — violates strict 50% Premium/Discount rule for ${isBullish ? "Longs" : "Shorts"}. Wait for pullback.`,
      metrics: [
        { label: "Equilibrium (0.50)", value: `${formatPrice(structural.equilibrium50, symbol)} (${currentZone})`, highlight: fibFilterPassed },
        { label: "OTE Zone (0.618–0.786)", value: `${formatPrice(Math.min(structural.ote618, structural.ote786), symbol)} – ${formatPrice(Math.max(structural.ote618, structural.ote786), symbol)}` },
        { label: "0.705 Sweet Spot", value: formatPrice(structural.ote705SweetSpot, symbol), highlight: isNearOte },
        { label: "Fib Target Extensions", value: `${formatPrice(structural.ext1272_TP1, symbol)} / ${formatPrice(structural.ext1618_TP2, symbol)}` },
      ],
    },
    {
      id: "price-action",
      moduleNumber: 3,
      title: "Institutional Candlestick & POI Confirmation",
      aligned: mod3Aligned,
      score: mod3Score,
      maxScore: 15,
      summary: mod3Aligned
        ? `Confirmed ${structural.detectedPattern} inside valid ${currentZone} POI.`
        : `Awaiting confirmed displacement or sweep candle inside ${isBullish ? "Discount" : "Premium"} POI (${structural.detectedPattern}).`,
      metrics: [
        { label: "Closed-Bar Trigger", value: structural.detectedPattern, highlight: structural.hasStrongCandleTrigger },
        { label: "POI Proximity", value: isInsideEntryZone ? "Inside Active PD Array" : fibFilterPassed ? "Inside Dealing Zone" : "Outside POI" },
        { label: "Volatility Expansion", value: structural.volumeExpansion ? "Above Average Range/Vol" : "Normal / Compressed", highlight: structural.volumeExpansion },
        { label: "Live Spot Price", value: formatPrice(currentPrice, symbol) },
      ],
    },
    {
      id: "asset-quant",
      moduleNumber: 4,
      title:
        symbol.marketType === "CRYPTO_PERP"
          ? "Crypto Perps Orderflow (OI Δ, Funding & CVD)"
          : symbol.marketType === "SYNTHETIC"
          ? "Synthetic Z-Score & Pre-Spike Compression"
          : "Forex Macro SMT Divergence & Session Filter",
      aligned: mod4Aligned,
      score: mod4Score,
      maxScore: 20,
      summary: mod4Summary,
      metrics: mod4Metrics,
    },
    {
      id: "risk-execution",
      moduleNumber: 5,
      title: "Dynamic Risk & Structural Invalidation Gate",
      aligned: mod5Aligned,
      score: mod5Score,
      maxScore: 15,
      summary: mod5Aligned
        ? `Asymmetric risk profile verified: 1:${rrNumeric} R:R to TP2 with 0.35× ATR structural stop-hunt buffer.`
        : `Insufficient Risk-to-Reward (1:${rrNumeric} < 1:2.0 minimum). Trade gated to WAIT until deeper OTE retest.`,
      metrics: [
        { label: "Optimal Entry", value: formatPrice(structural.optimalEntry, symbol), highlight: true },
        { label: "Structural SL (+0.35 ATR)", value: formatPrice(structural.invalidationSL, symbol) },
        { label: "True Computed R:R", value: `1:${rrNumeric} (TP2)`, highlight: mod5Aligned },
        { label: "Execution Gate", value: mod5Aligned ? "PASS (≥ 1:2.0)" : "BLOCKED (< 1:2.0)", highlight: mod5Aligned },
      ],
    },
  ];

  const totalScore = modules.reduce((sum, m) => sum + m.score, 0);
  const alignedModulesCount = modules.filter((m) => m.aligned).length;
  const highProbabilityTrigger =
    alignedModulesCount >= 3 && mod5Aligned && structural.rawBias !== "RANGING";

  const directionalBias: QuantitativeEvaluation["directionalBias"] = highProbabilityTrigger
    ? isBullish
      ? "BULLISH"
      : "BEARISH"
    : "NEUTRAL (WAIT FOR LIQUIDITY SWEEP)";

  const formulaParts = [
    structureEventLabelMap[structural.structureEvent],
    pdArrayType,
    fibFilterPassed ? `${currentZone} OTE` : "Awaiting OTE",
    dynamicSweepActive ? "Sweep Active" : `1:${rrNumeric} R:R`,
  ];
  const confluenceFormulaBanner = `${formulaParts.join(" + ")} = ${totalScore}% Confluence (${alignedModulesCount}/5 Aligned)`;

  return {
    symbol,
    timeframe,
    evaluatedAt: new Date().toISOString(),
    directionalBias,
    confluenceScorePct: totalScore,
    alignedModulesCount,
    highProbabilityTrigger,
    confluenceFormulaBanner,
    modules,
    fibonacci: {
      swingLow: structural.swingLow,
      swingHigh: structural.swingHigh,
      equilibrium50: structural.equilibrium50,
      ote618: structural.ote618,
      ote705SweetSpot: structural.ote705SweetSpot,
      ote786: structural.ote786,
      ext1272_TP1: structural.ext1272_TP1,
      ext1618_TP2: structural.ext1618_TP2,
      ext2000_TP3: structural.ext2000_TP3,
      currentZone,
      filterPassed: fibFilterPassed,
      filterExplanation: modules[1].summary,
    },
    smcStructure: {
      htfStructure: `${structural.mtfAlignment.d1.bias} (1D) · ${structural.mtfAlignment.h4.bias} (4H)`,
      ltfStructure: `${structureEventLabelMap[structural.structureEvent]} on ${timeframe}`,
      structureEvent: structural.structureEvent,
      pdArrayType,
      pdArrayZone,
      bslPool: structural.bslPool,
      sslPool: structural.sslPool,
      pdh: structural.pdh,
      pdl: structural.pdl,
      asianHigh: structural.asianHigh,
      asianLow: structural.asianLow,
      liquiditySweepDetected: dynamicSweepActive,
      sweepDescription: dynamicSweepActive
        ? `Active liquidity sweep detected near ${formatPrice(isBullish ? structural.sslPool : structural.bslPool, symbol)}.`
        : `Resting ${isBullish ? "SSL" : "BSL"} mapped at ${formatPrice(isBullish ? structural.sslPool : structural.bslPool, symbol)}.`,
      killzoneWindow: killzone.windowName,
      killzoneActive: killzone.active,
    },
    mtfAlignment: structural.mtfAlignment,
    overlays: {
      orderBlocks: structural.orderBlocks,
      fairValueGaps: structural.fairValueGaps,
      liquidityPools: structural.liquidityPools,
      swings: structural.swings,
    },
    smtDivergence: structural.smtDivergence,
    syntheticMetrics: structural.syntheticMetrics,
    candlestickTrigger: {
      patternName: structural.detectedPattern,
      insideHTFPOI: mod3Aligned,
      volumeExpansion: structural.volumeExpansion,
      filteredOutReason: mod3Aligned ? undefined : "Not yet confirmed inside Discount/Premium POI",
      details: modules[2].summary,
    },
    executionCard: {
      orderType: highProbabilityTrigger ? (isBullish ? "BUY LIMIT" : "SELL LIMIT") : "WAIT (NO TRIGGER)",
      entryZoneLow: structural.entryLow,
      entryZoneHigh: structural.entryHigh,
      optimalEntry705: structural.optimalEntry,
      invalidationSL: structural.invalidationSL,
      atrBufferApplied: `0.35× ATR Buffer (+${formatPrice(structural.atr * 0.35, symbol)}) Beyond Structural Origin`,
      tp1_1272: structural.ext1272_TP1,
      tp2_1618: structural.ext1618_TP2,
      tp3_2000: structural.ext2000_TP3,
      riskRewardRatio: `1:${rrNumeric}`,
      rrNumeric,
    },
  };
}

/**
 * Builds a clean, compact JSON payload of exact computed SMC mathematics
 * to feed into the Hybrid Quant + Gemini Vision backend.
 */
export function buildQuantContextPayload(
  evaluation: QuantitativeEvaluation,
  livePrice: number,
  rsiDivergences: { type: string; valRsi1: number; valRsi2: number }[] = [],
  tradeHistory: any[] = []
) {
  const symTrades = tradeHistory.filter(
    (t) =>
      String(t.symbol || "").toUpperCase() === evaluation.symbol.ticker.toUpperCase() ||
      String(t.symbol || "").toUpperCase().includes(evaluation.symbol.ticker.toUpperCase())
  );
  const symWins = symTrades.filter((t) => t.status === "WON").length;
  const symLosses = symTrades.filter((t) => t.status === "LOST").length;

  return {
    symbol: evaluation.symbol.ticker,
    assetName: evaluation.symbol.name,
    marketType: evaluation.symbol.marketType,
    timeframe: evaluation.timeframe,
    livePrice,
    directionalBias: evaluation.directionalBias,
    confluenceScorePct: evaluation.confluenceScorePct,
    alignedModulesCount: evaluation.alignedModulesCount,
    highProbabilityTrigger: evaluation.highProbabilityTrigger,
    confluenceFormula: evaluation.confluenceFormulaBanner,
    structure: evaluation.smcStructure,
    mtf: {
      d1Bias: evaluation.mtfAlignment.d1.bias,
      d1Event: evaluation.mtfAlignment.d1.structureEvent,
      h4Bias: evaluation.mtfAlignment.h4.bias,
      h4Event: evaluation.mtfAlignment.h4.structureEvent,
      alignedWithHtf: evaluation.mtfAlignment.alignedWithHtf,
      note: evaluation.mtfAlignment.alignmentNote,
    },
    fibonacci: evaluation.fibonacci,
    orderBlocks: evaluation.overlays.orderBlocks.slice(-3),
    fairValueGaps: evaluation.overlays.fairValueGaps.slice(-3),
    liquidityPools: evaluation.overlays.liquidityPools.slice(-4),
    smtDivergence: evaluation.smtDivergence,
    syntheticMetrics: evaluation.syntheticMetrics || null,
    candlestickTrigger: evaluation.candlestickTrigger,
    executionCard: evaluation.executionCard,
    rsiDivergences: rsiDivergences.slice(-2),
    moduleBreakdown: evaluation.modules.map((m) => ({
      module: m.title,
      aligned: m.aligned,
      score: `${m.score}/${m.maxScore}`,
      summary: m.summary,
    })),
    symbolJournalStats: {
      totalOnSymbol: symTrades.length,
      wins: symWins,
      losses: symLosses,
      winRatePct: symTrades.length > 0 ? Math.round((symWins / symTrades.length) * 100) : null,
    },
  };
}

/**
 * Universal evaluator convenience wrapper.
 */
export function evaluateMultiFactorConfluence(
  symbol: SyntheticSymbol,
  timeframe: string = "H1",
  aiResult?: any,
  livePriceOverride?: number,
  candles?: StandardCandle[],
  futuresTelemetry?: FuturesTelemetry | null,
  mtfCandles?: MultiTimeframeCandles | null,
  smtReference?: SmtReferenceData | null
): QuantitativeEvaluation {
  const safeCandles: StandardCandle[] = candles && candles.length > 0 ? candles : [];
  const structural = evaluateStructuralScan(
    safeCandles,
    symbol,
    timeframe,
    aiResult,
    mtfCandles,
    smtReference
  );

  const price =
    livePriceOverride ||
    (safeCandles.length > 0 ? safeCandles[safeCandles.length - 1].close : structural.optimalEntry);

  const liveCandle: StandardCandle = {
    timestamp: Math.floor(Date.now() / 1000),
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 0,
    isClosed: false,
  };

  return evaluateLiveTick(liveCandle, structural, futuresTelemetry);
}
