import { SyntheticSymbol } from "../data/symbols";

export interface StandardCandle {
  timestamp: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean; // True when candle finalizes, false on live intra-candle ticks
}

export interface FuturesTelemetry {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  openInterest: number;
  openInterestValue: number;
  oiDeltaPct24h?: number; // Real 24h OI % change from Bybit open-interest endpoint
  cvdNetVolume?: number; // Rolling net buy minus sell volume from public trades / candles
  cvdBias?: "BULLISH_ABSORPTION" | "BEARISH_DISTRIBUTION" | "NEUTRAL";
  markPrice: number;
  indexPrice: number;
  volume24h: number;
}

export type FeedStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";

export interface FeedTelemetry {
  provider: "Bybit V5 Linear WS" | "Deriv Public WS" | "TwelveData WS" | "Simulated Engine";
  status: FeedStatus;
  latencyMs: number;
  lastTickTime: number;
  symbol: string;
  timeframe: string;
  activeCandleCount: number;
  futuresTelemetry?: FuturesTelemetry | null;
  errorMessage?: string;
}

export interface MultiTimeframeCandles {
  d1: StandardCandle[];
  h4: StandardCandle[];
  loadedForTicker: string;
  fetchedAt: number;
}

export interface SmtReferenceData {
  referenceTicker: string;
  referenceName: string;
  correlationType: "POSITIVE" | "INVERSE";
  candles: StandardCandle[];
}

export interface MarketDataSubscriptionCallbacks {
  onHistory: (candles: StandardCandle[]) => void;
  onCandleUpdate: (candle: StandardCandle) => void;
  onFuturesTelemetry?: (telemetry: FuturesTelemetry) => void;
  onTelemetryChange: (telemetry: FeedTelemetry) => void;
}

// Map user timeframe strings to Deriv granularity in seconds
export function timeframeToDerivGranularity(tf: string): number {
  const normalized = tf.toUpperCase().trim();
  switch (normalized) {
    case "M1":
    case "1M":
    case "1":
      return 60;
    case "M5":
    case "5M":
    case "5":
      return 300;
    case "M15":
    case "15M":
    case "15":
      return 900;
    case "M30":
    case "30M":
    case "30":
      return 1800;
    case "H1":
    case "1H":
    case "60":
      return 3600;
    case "H4":
    case "4H":
    case "240":
      return 14400;
    case "D1":
    case "1D":
    case "D":
      return 86400;
    default:
      return 3600;
  }
}

// Map user timeframe strings to Bybit interval parameter
export function timeframeToBybitInterval(tf: string): string {
  const normalized = tf.toUpperCase().trim();
  switch (normalized) {
    case "M1":
    case "1M":
    case "1":
      return "1";
    case "M5":
    case "5M":
    case "5":
      return "5";
    case "M15":
    case "15M":
    case "15":
      return "15";
    case "M30":
    case "30M":
    case "30":
      return "30";
    case "H1":
    case "1H":
    case "60":
      return "60";
    case "H4":
    case "4H":
    case "240":
      return "240";
    case "D1":
    case "1D":
    case "D":
      return "D";
    default:
      return "60";
  }
}

// Normalize ticker for Bybit V5 Linear USDT Perps
export function getBybitSymbol(ticker: string): string {
  let cleaned = ticker.toUpperCase().trim();
  if (cleaned.endsWith(".P")) {
    cleaned = cleaned.slice(0, -2);
  }
  if (!cleaned.endsWith("USDT") && !cleaned.endsWith("USD")) {
    cleaned = `${cleaned}USDT`;
  }
  return cleaned;
}

// Map ticker to Deriv technical symbols
export function getDerivSymbolName(ticker: string): string {
  const map: Record<string, string> = {
    // Volatility Indices (Standard)
    V10: "R_10",
    V25: "R_25",
    V50: "R_50",
    V75: "R_75",
    V100: "R_100",

    // Volatility Indices (1-Second Cadence)
    V101S: "1HZ10V",
    V151S: "1HZ15V",
    V251S: "1HZ25V",
    V301S: "1HZ30V",
    V501S: "1HZ50V",
    V751S: "1HZ75V",
    V901S: "1HZ90V",
    V1001S: "1HZ100V",
    V1501S: "1HZ150V",
    V2001S: "1HZ200V",
    V2501S: "1HZ250V",
    V3001S: "1HZ300V",

    // Boom & Crash Suite
    B300: "BOOM300",
    B500: "BOOM500",
    B600: "BOOM600",
    B900: "BOOM900",
    B1000: "BOOM1000",
    C300: "CRASH300",
    C500: "CRASH500",
    C600: "CRASH600",
    C900: "CRASH900",
    C1000: "CRASH1000",

    // Step Indices
    STEP: "stpRNG",
    STEP200: "stpRNG200",
    STEP500: "stpRNG500",

    // Jump Indices
    J10: "JD10",
    J25: "JD25",
    J50: "JD50",
    J75: "JD75",
    J100: "JD100",

    // Range Break Indices
    RB100: "RDBR100",
    RB200: "RDBR200",

    // DEX Indices
    DEX600: "DEX600UP",
    DEX900: "DEX900UP",
    DEX1500: "DEX1500UP",

    // Major & Minor Forex Pairs
    EURUSD: "frxEURUSD",
    GBPUSD: "frxGBPUSD",
    USDJPY: "frxUSDJPY",
    AUDUSD: "frxAUDUSD",
    USDCAD: "frxUSDCAD",
    USDCHF: "frxUSDCHF",
    NZDUSD: "frxNZDUSD",

    EURGBP: "frxEURGBP",
    EURJPY: "frxEURJPY",
    GBPJPY: "frxGBPJPY",
    AUDJPY: "frxAUDJPY",
    CADJPY: "frxCADJPY",
    CHFJPY: "frxCHFJPY",
    NZDJPY: "frxNZDJPY",

    EURAUD: "frxEURAUD",
    EURCAD: "frxEURCAD",
    EURCHF: "frxEURCHF",
    EURNZD: "frxEURNZD",

    GBPAUD: "frxGBPAUD",
    GBPCAD: "frxGBPCAD",
    GBPCHF: "frxGBPCHF",
    GBPNZD: "frxGBPNZD",

    AUDCAD: "frxAUDCAD",
    AUDCHF: "frxAUDCHF",
    AUDNZD: "frxAUDNZD",

    CADCHF: "frxCADCHF",
    NZDCAD: "frxNZDCAD",
    NZDCHF: "frxNZDCHF",

    // Emerging Market / Exotic Forex Pairs
    USDZAR: "frxUSDZAR",
    USDMXN: "frxUSDMXN",
    USDTRY: "frxUSDTRY",
    USDSGD: "frxUSDSGD",
    USDHKD: "frxUSDHKD",
    USDSEK: "frxUSDSEK",
    USDNOK: "frxUSDNOK",
    USDPLN: "frxUSDPLN",
    USDCNH: "frxUSDCNH",

    // Commodities & Metals
    XAUUSD: "frxXAUUSD",
    XAGUSD: "frxXAGUSD",
    USOIL: "frxUSOIL",
    UKOIL: "frxUKOIL",
    COPPER: "frxCOPPER",

    // Global Equity Indices
    US100: "OTC_NDX",
    US30: "OTC_DJI",
    US500: "OTC_SPC",
    GER40: "OTC_GDAXI",
    UK100: "OTC_FCHI",
    JP225: "OTC_N225",
  };

  const clean = ticker.toUpperCase().trim();
  if (map[clean]) return map[clean];
  if (clean.length === 6 && !clean.startsWith("FRX") && !clean.startsWith("R_")) {
    return `frx${clean}`;
  }
  return clean;
}

// Paired correlation map for real Smart Money Technique (SMT) Divergence scanning
export function getSmtReferencePair(
  symbol: SyntheticSymbol
): { ticker: string; name: string; correlationType: "POSITIVE" | "INVERSE"; marketType: "FOREX" | "CRYPTO_PERP" } | null {
  const clean = symbol.ticker.toUpperCase().trim();
  const pairs: Record<
    string,
    { ticker: string; name: string; correlationType: "POSITIVE" | "INVERSE"; marketType: "FOREX" | "CRYPTO_PERP" }
  > = {
    EURUSD: { ticker: "GBPUSD", name: "GBP/USD", correlationType: "POSITIVE", marketType: "FOREX" },
    GBPUSD: { ticker: "EURUSD", name: "EUR/USD", correlationType: "POSITIVE", marketType: "FOREX" },
    AUDUSD: { ticker: "NZDUSD", name: "NZD/USD", correlationType: "POSITIVE", marketType: "FOREX" },
    NZDUSD: { ticker: "AUDUSD", name: "AUD/USD", correlationType: "POSITIVE", marketType: "FOREX" },
    USDJPY: { ticker: "USDCHF", name: "USD/CHF", correlationType: "POSITIVE", marketType: "FOREX" },
    USDCHF: { ticker: "EURUSD", name: "EUR/USD", correlationType: "INVERSE", marketType: "FOREX" },
    USDCAD: { ticker: "EURUSD", name: "EUR/USD", correlationType: "INVERSE", marketType: "FOREX" },
    EURJPY: { ticker: "GBPJPY", name: "GBP/JPY", correlationType: "POSITIVE", marketType: "FOREX" },
    GBPJPY: { ticker: "EURJPY", name: "EUR/JPY", correlationType: "POSITIVE", marketType: "FOREX" },
    XAUUSD: { ticker: "XAGUSD", name: "Silver (XAG/USD)", correlationType: "POSITIVE", marketType: "FOREX" },
    XAGUSD: { ticker: "XAUUSD", name: "Gold (XAU/USD)", correlationType: "POSITIVE", marketType: "FOREX" },
    US100: { ticker: "US500", name: "S&P 500 (US500)", correlationType: "POSITIVE", marketType: "FOREX" },
    US500: { ticker: "US100", name: "Nasdaq 100 (US100)", correlationType: "POSITIVE", marketType: "FOREX" },
    US30: { ticker: "US500", name: "S&P 500 (US500)", correlationType: "POSITIVE", marketType: "FOREX" },
    "BTCUSDT.P": { ticker: "ETHUSDT.P", name: "ETH/USDT Perp", correlationType: "POSITIVE", marketType: "CRYPTO_PERP" },
    "ETHUSDT.P": { ticker: "BTCUSDT.P", name: "BTC/USDT Perp", correlationType: "POSITIVE", marketType: "CRYPTO_PERP" },
    "SOLUSDT.P": { ticker: "BTCUSDT.P", name: "BTC/USDT Perp", correlationType: "POSITIVE", marketType: "CRYPTO_PERP" },
  };
  if (pairs[clean]) return pairs[clean];
  if (symbol.marketType === "CRYPTO_PERP" && clean !== "BTCUSDT.P") {
    return { ticker: "BTCUSDT.P", name: "BTC/USDT Perp", correlationType: "POSITIVE", marketType: "CRYPTO_PERP" };
  }
  return null;
}

/**
 * Multi-Provider, Multi-Subscriber MarketDataService
 * Prevents duplicate sockets by multiplexing a single active (symbol, timeframe) stream
 * across all mounted React components, plus provides parallel MTF & SMT REST/one-shot fetches.
 */
export class MarketDataService {
  private static instance: MarketDataService;
  private activeWs: WebSocket | null = null;
  private activeHeartbeat: any = null;
  private reconnectTimeout: any = null;
  private reconnectAttempt: number = 0;
  private maxReconnectAttempts: number = 5;
  private isDestroyed: boolean = false;

  private activeKey: string | null = null;
  private currentSymbol: SyntheticSymbol | null = null;
  private currentTimeframe: string = "H1";
  private subscribers: Set<MarketDataSubscriptionCallbacks> = new Set();

  // Cached state for instant replay to new subscribers & delta accumulation
  private cachedFuturesTelemetry: FuturesTelemetry | null = null;
  private lastKnownCandles: StandardCandle[] = [];
  private lastTelemetry: FeedTelemetry | null = null;
  private lastPingSentAt: number = 0;
  private currentLatencyMs: number = 24;
  private rollingCvdNet: number = 0;
  private rollingCvdBuy: number = 0;
  private rollingCvdSell: number = 0;

  // Short-TTL caches for MTF & SMT snapshots to avoid hammering public APIs
  private mtfCache: Map<string, MultiTimeframeCandles> = new Map();
  private smtCache: Map<string, { fetchedAt: number; data: SmtReferenceData }> = new Map();

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  private getStreamKey(symbol: SyntheticSymbol, timeframe: string): string {
    return `${symbol.marketType}:${symbol.ticker}:${timeframe.toUpperCase()}`;
  }

  private broadcastHistory(candles: StandardCandle[]) {
    this.subscribers.forEach((cb) => cb.onHistory(candles));
  }

  private broadcastCandleUpdate(candle: StandardCandle) {
    this.subscribers.forEach((cb) => cb.onCandleUpdate(candle));
  }

  private broadcastFuturesTelemetry(telemetry: FuturesTelemetry) {
    this.subscribers.forEach((cb) => cb.onFuturesTelemetry?.(telemetry));
  }

  private broadcastTelemetry(telemetry: FeedTelemetry) {
    this.lastTelemetry = telemetry;
    this.subscribers.forEach((cb) => cb.onTelemetryChange(telemetry));
  }

  /**
   * Multiplexed subscribe: attaches listener to existing socket if (symbol, timeframe) matches,
   * otherwise cleanly transitions to the new stream.
   */
  public subscribe(
    symbol: SyntheticSymbol,
    timeframe: string,
    callbacks: MarketDataSubscriptionCallbacks
  ): () => void {
    const requestedKey = this.getStreamKey(symbol, timeframe);

    // If stream is already running for this exact symbol+timeframe, reuse socket & replay cache!
    if (this.activeKey === requestedKey && this.activeWs && !this.isDestroyed) {
      this.subscribers.add(callbacks);
      if (this.lastTelemetry) {
        callbacks.onTelemetryChange(this.lastTelemetry);
      }
      if (this.lastKnownCandles.length > 0) {
        callbacks.onHistory([...this.lastKnownCandles]);
      }
      if (this.cachedFuturesTelemetry) {
        callbacks.onFuturesTelemetry?.(this.cachedFuturesTelemetry);
      }

      return () => {
        this.subscribers.delete(callbacks);
        if (this.subscribers.size === 0) {
          this.unsubscribeCurrent();
        }
      };
    }

    // Switching symbol or timeframe: tear down previous stream and reset subscribers
    this.unsubscribeCurrent();
    this.subscribers.clear();
    this.subscribers.add(callbacks);

    this.activeKey = requestedKey;
    this.currentSymbol = symbol;
    this.currentTimeframe = timeframe;
    this.reconnectAttempt = 0;
    this.isDestroyed = false;
    this.cachedFuturesTelemetry = null;
    this.lastKnownCandles = [];
    this.lastTelemetry = null;
    this.rollingCvdNet = 0;
    this.rollingCvdBuy = 0;
    this.rollingCvdSell = 0;

    if (symbol.marketType === "CRYPTO_PERP") {
      this.initBybitFeed(symbol, timeframe);
    } else {
      this.initDerivFeed(symbol, timeframe);
    }

    return () => {
      this.subscribers.delete(callbacks);
      if (this.subscribers.size === 0 && this.activeKey === requestedKey) {
        this.unsubscribeCurrent();
      }
    };
  }

  public unsubscribeCurrent(): void {
    this.isDestroyed = true;
    this.activeKey = null;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.activeHeartbeat) {
      clearInterval(this.activeHeartbeat);
      this.activeHeartbeat = null;
    }

    if (this.activeWs) {
      try {
        if (this.activeWs.readyState === WebSocket.OPEN) {
          if (this.currentSymbol?.marketType === "CRYPTO_PERP") {
            const bybitSym = getBybitSymbol(this.currentSymbol.ticker);
            const interval = timeframeToBybitInterval(this.currentTimeframe);
            this.activeWs.send(
              JSON.stringify({
                op: "unsubscribe",
                args: [`kline.${interval}.${bybitSym}`, `tickers.${bybitSym}`, `publicTrade.${bybitSym}`],
              })
            );
          } else {
            this.activeWs.send(JSON.stringify({ forget_all: "candles" }));
          }
        }
        this.activeWs.close();
      } catch {
        // Ignore teardown exceptions
      }
      this.activeWs = null;
    }
  }

  // --------------------------------------------------------------------------
  // REAL MULTI-TIMEFRAME SNAPSHOT FETCHER (D1 + H4 without disrupting live WS)
  // --------------------------------------------------------------------------
  public async fetchMultiTimeframeCandles(symbol: SyntheticSymbol): Promise<MultiTimeframeCandles> {
    const cacheKey = `${symbol.marketType}:${symbol.ticker}`;
    const cached = this.mtfCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < 180_000) {
      return cached;
    }

    let d1: StandardCandle[] = [];
    let h4: StandardCandle[] = [];

    if (symbol.marketType === "CRYPTO_PERP") {
      const bybitSym = getBybitSymbol(symbol.ticker);
      const [d1Res, h4Res] = await Promise.all([
        this.fetchBybitRestCandles(bybitSym, "D", 60),
        this.fetchBybitRestCandles(bybitSym, "240", 100),
      ]);
      d1 = d1Res;
      h4 = h4Res;
    } else {
      const derivSym = getDerivSymbolName(symbol.ticker);
      const result = await this.fetchDerivHistoricalBatch([
        { symbol: derivSym, granularity: 86400, count: 60, key: "d1" },
        { symbol: derivSym, granularity: 14400, count: 100, key: "h4" },
      ]);
      d1 = result.d1 || [];
      h4 = result.h4 || [];
    }

    const payload: MultiTimeframeCandles = {
      d1,
      h4,
      loadedForTicker: symbol.ticker,
      fetchedAt: Date.now(),
    };
    if (d1.length > 0 || h4.length > 0) {
      this.mtfCache.set(cacheKey, payload);
    }
    return payload;
  }

  // --------------------------------------------------------------------------
  // REAL PAIRED SMT REFERENCE FETCHER (e.g. EURUSD <-> GBPUSD, XAU <-> XAG)
  // --------------------------------------------------------------------------
  public async fetchSmtReferenceData(
    symbol: SyntheticSymbol,
    timeframe: string
  ): Promise<SmtReferenceData | null> {
    const ref = getSmtReferencePair(symbol);
    if (!ref) return null;

    const cacheKey = `${ref.ticker}:${timeframe.toUpperCase()}`;
    const cached = this.smtCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < 90_000) {
      return cached.data;
    }

    let candles: StandardCandle[] = [];
    if (ref.marketType === "CRYPTO_PERP") {
      const bybitSym = getBybitSymbol(ref.ticker);
      const interval = timeframeToBybitInterval(timeframe);
      candles = await this.fetchBybitRestCandles(bybitSym, interval, 80);
    } else {
      const derivSym = getDerivSymbolName(ref.ticker);
      const gran = timeframeToDerivGranularity(timeframe);
      const batch = await this.fetchDerivHistoricalBatch([
        { symbol: derivSym, granularity: gran, count: 80, key: "smt" },
      ]);
      candles = batch.smt || [];
    }

    if (candles.length < 15) return null;

    const data: SmtReferenceData = {
      referenceTicker: ref.ticker,
      referenceName: ref.name,
      correlationType: ref.correlationType,
      candles,
    };
    this.smtCache.set(cacheKey, { fetchedAt: Date.now(), data });
    return data;
  }

  private async fetchBybitRestCandles(
    bybitSym: string,
    interval: string,
    limit: number
  ): Promise<StandardCandle[]> {
    try {
      const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${bybitSym}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      if (json.retCode !== 0 || !Array.isArray(json.result?.list)) return [];
      const rawList = [...json.result.list].reverse();
      return rawList.map((item: any, idx: number) => ({
        timestamp: Math.floor(Number(item[0]) / 1000),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]) || 0,
        isClosed: idx !== rawList.length - 1,
      }));
    } catch {
      return [];
    }
  }

  private async fetchBybitOiDelta24h(bybitSym: string): Promise<number | undefined> {
    try {
      const url = `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${bybitSym}&intervalTime=1h&limit=25`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return undefined;
      const json = await res.json();
      const list = json?.result?.list;
      if (!Array.isArray(list) || list.length < 2) return undefined;
      const newest = parseFloat(list[0].openInterest);
      const oldest = parseFloat(list[list.length - 1].openInterest);
      if (!oldest || !Number.isFinite(newest) || !Number.isFinite(oldest)) return undefined;
      return Number((((newest - oldest) / oldest) * 100).toFixed(2));
    } catch {
      return undefined;
    }
  }

  private fetchDerivHistoricalBatch(
    requests: { symbol: string; granularity: number; count: number; key: string }[]
  ): Promise<Record<string, StandardCandle[]>> {
    return new Promise((resolve) => {
      const results: Record<string, StandardCandle[]> = {};
      const derivAppId =
        (import.meta as any).env?.VITE_DERIV_APP_ID ||
        (import.meta as any).env?.NEXT_PUBLIC_DERIV_APP_ID ||
        "1089";

      let settled = false;
      let receivedCount = 0;
      let ws: WebSocket | null = null;

      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          ws?.close();
        } catch {}
        resolve(results);
      };

      const timeout = setTimeout(finish, 4500);

      try {
        ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppId}`);
        ws.onopen = () => {
          requests.forEach((req, idx) => {
            ws?.send(
              JSON.stringify({
                ticks_history: req.symbol,
                adjust_start_time: 1,
                count: req.count,
                end: "latest",
                start: 1,
                style: "candles",
                granularity: req.granularity,
                req_id: idx + 101,
              })
            );
          });
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const reqId = Number(msg.req_id);
            const idx = reqId - 101;
            if (idx >= 0 && idx < requests.length) {
              const targetKey = requests[idx].key;
              if (Array.isArray(msg.candles)) {
                results[targetKey] = msg.candles.map((c: any, i: number) => ({
                  timestamp: Number(c.epoch),
                  open: Number(c.open),
                  high: Number(c.high),
                  low: Number(c.low),
                  close: Number(c.close),
                  volume: 0,
                  isClosed: i !== msg.candles.length - 1,
                }));
              } else {
                results[targetKey] = [];
              }
              receivedCount++;
              if (receivedCount >= requests.length) {
                clearTimeout(timeout);
                finish();
              }
            }
          } catch {}
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          finish();
        };
      } catch {
        clearTimeout(timeout);
        finish();
      }
    });
  }

  // --------------------------------------------------------------------------
  // PROVIDER 1: Bybit V5 Linear (USDT Perpetual) Feed (Keyless)
  // --------------------------------------------------------------------------
  private async initBybitFeed(symbol: SyntheticSymbol, timeframe: string) {
    const bybitSym = getBybitSymbol(symbol.ticker);
    const interval = timeframeToBybitInterval(timeframe);
    const streamKey = this.getStreamKey(symbol, timeframe);

    this.broadcastTelemetry({
      provider: "Bybit V5 Linear WS",
      status: "CONNECTING",
      latencyMs: this.currentLatencyMs,
      lastTickTime: Date.now(),
      symbol: symbol.ticker,
      timeframe,
      activeCandleCount: 0,
      futuresTelemetry: null,
    });

    // 1. REST Backfill: Fetch last 300 candles + 24h OI delta in parallel
    try {
      const [normalized, oiDelta24h] = await Promise.all([
        this.fetchBybitRestCandles(bybitSym, interval, 300),
        this.fetchBybitOiDelta24h(bybitSym),
      ]);

      if (this.isDestroyed || this.activeKey !== streamKey) return;

      if (normalized.length > 0) {
        this.lastKnownCandles = normalized;
        // Seed initial rolling CVD estimate from last 20 closed candles' directional volume
        const recent20 = normalized.slice(-20);
        let buyVol = 0;
        let sellVol = 0;
        for (const c of recent20) {
          if (c.close >= c.open) buyVol += c.volume;
          else sellVol += c.volume;
        }
        this.rollingCvdBuy = buyVol;
        this.rollingCvdSell = sellVol;
        this.rollingCvdNet = buyVol - sellVol;

        this.broadcastHistory(normalized);
      }

      if (oiDelta24h !== undefined) {
        this.cachedFuturesTelemetry = {
          symbol: symbol.ticker,
          fundingRate: this.cachedFuturesTelemetry?.fundingRate ?? 0.0001,
          nextFundingTime: this.cachedFuturesTelemetry?.nextFundingTime ?? Date.now() + 8 * 3600 * 1000,
          openInterest: this.cachedFuturesTelemetry?.openInterest ?? 0,
          openInterestValue: this.cachedFuturesTelemetry?.openInterestValue ?? 0,
          oiDeltaPct24h: oiDelta24h,
          cvdNetVolume: this.rollingCvdNet,
          cvdBias: this.computeCvdBias(),
          markPrice: this.cachedFuturesTelemetry?.markPrice ?? (normalized[normalized.length - 1]?.close || symbol.defaultPrice),
          indexPrice: this.cachedFuturesTelemetry?.indexPrice ?? (normalized[normalized.length - 1]?.close || symbol.defaultPrice),
          volume24h: this.cachedFuturesTelemetry?.volume24h ?? 0,
        };
        this.broadcastFuturesTelemetry(this.cachedFuturesTelemetry);
      }
    } catch (err) {
      console.warn("[Bybit REST Backfill] Failed to load REST history, continuing to WS:", err);
    }

    if (this.isDestroyed || this.activeKey !== streamKey) return;

    // 2. Open Bybit Public Linear WebSocket (kline + tickers + publicTrade for real CVD)
    const wsUrl = "wss://stream.bybit.com/v5/public/linear";
    try {
      const ws = new WebSocket(wsUrl);
      this.activeWs = ws;

      ws.onopen = () => {
        if (this.isDestroyed || this.activeWs !== ws) return;
        this.reconnectAttempt = 0;

        ws.send(
          JSON.stringify({
            op: "subscribe",
            args: [`kline.${interval}.${bybitSym}`, `tickers.${bybitSym}`, `publicTrade.${bybitSym}`],
          })
        );

        this.lastPingSentAt = Date.now();
        this.activeHeartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            this.lastPingSentAt = Date.now();
            ws.send(JSON.stringify({ op: "ping" }));
          }
        }, 20000);

        this.broadcastTelemetry({
          provider: "Bybit V5 Linear WS",
          status: "CONNECTED",
          latencyMs: this.currentLatencyMs,
          lastTickTime: Date.now(),
          symbol: symbol.ticker,
          timeframe,
          activeCandleCount: this.lastKnownCandles.length,
          futuresTelemetry: this.cachedFuturesTelemetry,
        });
      };

      ws.onmessage = (event) => {
        if (this.isDestroyed || this.activeWs !== ws) return;

        try {
          const msg = JSON.parse(event.data);

          if (msg.op === "pong" || msg.ret_msg === "pong") {
            if (this.lastPingSentAt > 0) {
              this.currentLatencyMs = Math.max(12, Date.now() - this.lastPingSentAt);
            }
            return;
          }

          // A) Kline stream parsing
          if (msg.topic && msg.topic.startsWith("kline.")) {
            if (Array.isArray(msg.data) && msg.data.length > 0) {
              const k = msg.data[0];
              const candle: StandardCandle = {
                timestamp: Math.floor(Number(k.start) / 1000),
                open: parseFloat(k.open),
                high: parseFloat(k.high),
                low: parseFloat(k.low),
                close: parseFloat(k.close),
                volume: parseFloat(k.volume) || 0,
                isClosed: Boolean(k.confirm),
              };

              this.updateLocalCandles(candle);
              this.broadcastCandleUpdate(candle);

              this.broadcastTelemetry({
                provider: "Bybit V5 Linear WS",
                status: "CONNECTED",
                latencyMs: this.currentLatencyMs,
                lastTickTime: Date.now(),
                symbol: symbol.ticker,
                timeframe,
                activeCandleCount: this.lastKnownCandles.length,
                futuresTelemetry: this.cachedFuturesTelemetry,
              });
            }
          }
          // B) Public trade tape for real-time CVD delta accumulation
          else if (msg.topic && msg.topic.startsWith("publicTrade.")) {
            if (Array.isArray(msg.data)) {
              for (const trade of msg.data) {
                const qty = parseFloat(trade.v) || 0;
                if (trade.S === "Buy") {
                  this.rollingCvdBuy += qty;
                  this.rollingCvdNet += qty;
                } else if (trade.S === "Sell") {
                  this.rollingCvdSell += qty;
                  this.rollingCvdNet -= qty;
                }
              }
              if (this.cachedFuturesTelemetry) {
                this.cachedFuturesTelemetry = {
                  ...this.cachedFuturesTelemetry,
                  cvdNetVolume: this.rollingCvdNet,
                  cvdBias: this.computeCvdBias(),
                };
              }
            }
          }
          // C) Tickers stream parsing (Snapshot + Delta handling)
          else if (msg.topic && msg.topic.startsWith("tickers.")) {
            const raw = msg.data;
            if (raw) {
              const prev = this.cachedFuturesTelemetry || {
                symbol: symbol.ticker,
                fundingRate: 0.0001,
                nextFundingTime: Date.now() + 8 * 3600 * 1000,
                openInterest: 0,
                openInterestValue: 0,
                oiDeltaPct24h: undefined,
                cvdNetVolume: this.rollingCvdNet,
                cvdBias: this.computeCvdBias(),
                markPrice: raw.markPrice ? parseFloat(raw.markPrice) : symbol.defaultPrice,
                indexPrice: raw.indexPrice ? parseFloat(raw.indexPrice) : symbol.defaultPrice,
                volume24h: 0,
              };

              const updated: FuturesTelemetry = {
                symbol: symbol.ticker,
                fundingRate: raw.fundingRate !== undefined ? parseFloat(raw.fundingRate) : prev.fundingRate,
                nextFundingTime: raw.nextFundingTime !== undefined ? Number(raw.nextFundingTime) : prev.nextFundingTime,
                openInterest: raw.openInterest !== undefined ? parseFloat(raw.openInterest) : prev.openInterest,
                openInterestValue:
                  raw.openInterestValue !== undefined ? parseFloat(raw.openInterestValue) : prev.openInterestValue,
                oiDeltaPct24h: prev.oiDeltaPct24h,
                cvdNetVolume: this.rollingCvdNet,
                cvdBias: this.computeCvdBias(),
                markPrice: raw.markPrice !== undefined ? parseFloat(raw.markPrice) : prev.markPrice,
                indexPrice: raw.indexPrice !== undefined ? parseFloat(raw.indexPrice) : prev.indexPrice,
                volume24h: raw.volume24h !== undefined ? parseFloat(raw.volume24h) : prev.volume24h,
              };

              this.cachedFuturesTelemetry = updated;
              this.broadcastFuturesTelemetry(updated);

              this.broadcastTelemetry({
                provider: "Bybit V5 Linear WS",
                status: "CONNECTED",
                latencyMs: this.currentLatencyMs,
                lastTickTime: Date.now(),
                symbol: symbol.ticker,
                timeframe,
                activeCandleCount: this.lastKnownCandles.length,
                futuresTelemetry: updated,
              });
            }
          }
        } catch (err) {
          console.warn("[Bybit WS Parse Error]", err);
        }
      };

      ws.onerror = () => {
        this.broadcastTelemetry({
          provider: "Bybit V5 Linear WS",
          status: "ERROR",
          latencyMs: this.currentLatencyMs,
          lastTickTime: Date.now(),
          symbol: symbol.ticker,
          timeframe,
          activeCandleCount: this.lastKnownCandles.length,
          futuresTelemetry: this.cachedFuturesTelemetry,
          errorMessage: "Bybit Linear WebSocket error. Retrying...",
        });
      };

      ws.onclose = () => {
        if (this.isDestroyed || this.activeWs !== ws) return;
        this.scheduleReconnect("CRYPTO_PERP");
      };
    } catch (e: any) {
      this.broadcastTelemetry({
        provider: "Bybit V5 Linear WS",
        status: "ERROR",
        latencyMs: this.currentLatencyMs,
        lastTickTime: Date.now(),
        symbol: symbol.ticker,
        timeframe,
        activeCandleCount: this.lastKnownCandles.length,
        futuresTelemetry: null,
        errorMessage: e.message || "Failed to initialize Bybit socket",
      });
      this.scheduleReconnect("CRYPTO_PERP");
    }
  }

  private computeCvdBias(): "BULLISH_ABSORPTION" | "BEARISH_DISTRIBUTION" | "NEUTRAL" {
    const total = this.rollingCvdBuy + this.rollingCvdSell;
    if (total <= 0) return "NEUTRAL";
    const imbalance = this.rollingCvdNet / total;
    if (imbalance > 0.08) return "BULLISH_ABSORPTION";
    if (imbalance < -0.08) return "BEARISH_DISTRIBUTION";
    return "NEUTRAL";
  }

  // --------------------------------------------------------------------------
  // PROVIDER 2: Deriv Public WebSocket Feed (Synthetics, Forex, Metals & Indices)
  // --------------------------------------------------------------------------
  private initDerivFeed(symbol: SyntheticSymbol, timeframe: string) {
    const derivAppId =
      (import.meta as any).env?.VITE_DERIV_APP_ID ||
      (import.meta as any).env?.NEXT_PUBLIC_DERIV_APP_ID ||
      "1089";

    const derivSymbol = getDerivSymbolName(symbol.ticker);
    const granularity = timeframeToDerivGranularity(timeframe);
    const providerLabel: "Deriv Public WS" = "Deriv Public WS";

    this.broadcastTelemetry({
      provider: providerLabel,
      status: "CONNECTING",
      latencyMs: this.currentLatencyMs,
      lastTickTime: Date.now(),
      symbol: symbol.ticker,
      timeframe,
      activeCandleCount: 0,
      futuresTelemetry: null,
    });

    const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${derivAppId}`;
    try {
      const ws = new WebSocket(wsUrl);
      this.activeWs = ws;

      ws.onopen = () => {
        if (this.isDestroyed || this.activeWs !== ws) return;
        this.reconnectAttempt = 0;

        ws.send(
          JSON.stringify({
            ticks_history: derivSymbol,
            adjust_start_time: 1,
            count: 300,
            end: "latest",
            start: 1,
            style: "candles",
            granularity,
            subscribe: 1,
          })
        );

        this.lastPingSentAt = Date.now();
        this.activeHeartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            this.lastPingSentAt = Date.now();
            ws.send(JSON.stringify({ ping: 1 }));
          }
        }, 30000);

        this.broadcastTelemetry({
          provider: providerLabel,
          status: "CONNECTED",
          latencyMs: this.currentLatencyMs,
          lastTickTime: Date.now(),
          symbol: symbol.ticker,
          timeframe,
          activeCandleCount: this.lastKnownCandles.length,
          futuresTelemetry: null,
        });
      };

      ws.onmessage = (event) => {
        if (this.isDestroyed || this.activeWs !== ws) return;

        try {
          const res = JSON.parse(event.data);

          if (res.ping === "pong" || res.msg_type === "ping") {
            if (this.lastPingSentAt > 0) {
              this.currentLatencyMs = Math.max(15, Date.now() - this.lastPingSentAt);
            }
            return;
          }

          if (res.error) {
            console.warn("[Deriv WS Error]", res.error.message);
            this.broadcastTelemetry({
              provider: providerLabel,
              status: "ERROR",
              latencyMs: this.currentLatencyMs,
              lastTickTime: Date.now(),
              symbol: symbol.ticker,
              timeframe,
              activeCandleCount: this.lastKnownCandles.length,
              errorMessage: res.error.message,
            });
            return;
          }

          if (res.msg_type === "candles" && Array.isArray(res.candles)) {
            const normalized: StandardCandle[] = res.candles.map((c: any, idx: number) => ({
              timestamp: Number(c.epoch),
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: 0,
              isClosed: idx !== res.candles.length - 1,
            }));

            this.lastKnownCandles = normalized;
            this.broadcastHistory(normalized);

            this.broadcastTelemetry({
              provider: providerLabel,
              status: "CONNECTED",
              latencyMs: this.currentLatencyMs,
              lastTickTime: Date.now(),
              symbol: symbol.ticker,
              timeframe,
              activeCandleCount: normalized.length,
              futuresTelemetry: null,
            });
          } else if (res.msg_type === "ohlc" && res.ohlc) {
            const o = res.ohlc;
            const openTime = Number(o.open_time);

            if (this.lastKnownCandles.length > 0) {
              const lastCandle = this.lastKnownCandles[this.lastKnownCandles.length - 1];
              if (openTime > lastCandle.timestamp) {
                lastCandle.isClosed = true;
                this.broadcastCandleUpdate({ ...lastCandle });
              }
            }

            const liveCandle: StandardCandle = {
              timestamp: openTime,
              open: Number(o.open),
              high: Number(o.high),
              low: Number(o.low),
              close: Number(o.close),
              volume: 0,
              isClosed: false,
            };

            this.updateLocalCandles(liveCandle);
            this.broadcastCandleUpdate(liveCandle);

            this.broadcastTelemetry({
              provider: providerLabel,
              status: "CONNECTED",
              latencyMs: this.currentLatencyMs,
              lastTickTime: Date.now(),
              symbol: symbol.ticker,
              timeframe,
              activeCandleCount: this.lastKnownCandles.length,
              futuresTelemetry: null,
            });
          }
        } catch (err) {
          console.warn("[Deriv WS Parse Error]", err);
        }
      };

      ws.onerror = () => {
        this.broadcastTelemetry({
          provider: providerLabel,
          status: "ERROR",
          latencyMs: this.currentLatencyMs,
          lastTickTime: Date.now(),
          symbol: symbol.ticker,
          timeframe,
          activeCandleCount: this.lastKnownCandles.length,
          errorMessage: "Deriv WebSocket connection interrupted. Retrying...",
        });
      };

      ws.onclose = () => {
        if (this.isDestroyed || this.activeWs !== ws) return;
        this.scheduleReconnect("DERIV");
      };
    } catch (e: any) {
      this.broadcastTelemetry({
        provider: providerLabel,
        status: "ERROR",
        latencyMs: this.currentLatencyMs,
        lastTickTime: Date.now(),
        symbol: symbol.ticker,
        timeframe,
        activeCandleCount: this.lastKnownCandles.length,
        errorMessage: e.message || "Failed to initialize Deriv socket",
      });
      this.scheduleReconnect("DERIV");
    }
  }

  private updateLocalCandles(newCandle: StandardCandle) {
    if (this.lastKnownCandles.length === 0) {
      this.lastKnownCandles.push(newCandle);
      return;
    }

    const lastIdx = this.lastKnownCandles.length - 1;
    const last = this.lastKnownCandles[lastIdx];

    if (last.timestamp === newCandle.timestamp) {
      this.lastKnownCandles[lastIdx] = newCandle;
    } else if (newCandle.timestamp > last.timestamp) {
      last.isClosed = true;
      this.lastKnownCandles.push(newCandle);
      if (this.lastKnownCandles.length > 350) {
        this.lastKnownCandles.shift();
      }
    }
  }

  private scheduleReconnect(feedType: "CRYPTO_PERP" | "DERIV") {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.warn(`[MarketDataService] Max reconnection attempts (${this.maxReconnectAttempts}) reached.`);
      return;
    }

    const delay = Math.min(8000, Math.pow(2, this.reconnectAttempt) * 1000);
    this.reconnectAttempt++;

    this.reconnectTimeout = setTimeout(() => {
      if (this.currentSymbol && this.subscribers.size > 0 && !this.isDestroyed) {
        if (feedType === "CRYPTO_PERP") {
          this.initBybitFeed(this.currentSymbol, this.currentTimeframe);
        } else {
          this.initDerivFeed(this.currentSymbol, this.currentTimeframe);
        }
      }
    }, delay);
  }
}

export const marketDataService = MarketDataService.getInstance();
