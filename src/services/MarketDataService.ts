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
  // Ensure USDT suffix for crypto linear perps
  if (!cleaned.endsWith("USDT") && (cleaned.startsWith("BTC") || cleaned.startsWith("ETH") || cleaned.startsWith("SOL") || cleaned.startsWith("BNB") || cleaned.startsWith("XRP") || cleaned.startsWith("SUI"))) {
    cleaned = `${cleaned}USDT`;
  }
  return cleaned;
}

// Map ticker to Deriv technical symbols
export function getDerivSymbolName(ticker: string): string {
  const map: Record<string, string> = {
    // Volatility Indices
    V10: "R_10",
    V101S: "1HZ10V",
    V151S: "1HZ15V",
    V25: "R_25",
    V251S: "1HZ25V",
    V301S: "1HZ30V",
    V50: "R_50",
    V501S: "1HZ50V",
    V75: "R_75",
    V751S: "1HZ75V",
    V901S: "1HZ90V",
    V100: "R_100",
    V1001S: "1HZ100V",
    V1501S: "1HZ150V",
    V2001S: "1HZ200V",
    V2501S: "1HZ250V",
    V3001S: "1HZ300V",
    // Boom & Crash
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
    // Step & Jump
    STEP: "stpRNG",
    J10: "JD10",
    J25: "JD25",
    J50: "JD50",
    J75: "JD75",
    J100: "JD100",
    RB100: "RDBR100",
    RB200: "RDBR200",
    // Forex Pairs
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
    GBPAUD: "frxGBPAUD",
    GBPCAD: "frxGBPCAD",
    AUDNZD: "frxAUDNZD",
    USDZAR: "frxUSDZAR",
    USDMXN: "frxUSDMXN",
    USDTRY: "frxUSDTRY",
    // Commodities
    XAUUSD: "frxXAUUSD",
    XAGUSD: "frxXAGUSD",
    USOIL: "frxUSOIL",
  };

  const clean = ticker.toUpperCase().trim();
  return map[clean] || clean;
}

/**
 * Multi-Provider MarketDataService
 * Handles keyless live WebSocket streaming, historical REST backfilling,
 * connection resilience with exponential backoff, and strict payload normalization.
 */
export class MarketDataService {
  private static instance: MarketDataService;
  private activeWs: WebSocket | null = null;
  private activeHeartbeat: any = null;
  private reconnectTimeout: any = null;
  private reconnectAttempt: number = 0;
  private maxReconnectAttempts: number = 5;
  private isDestroyed: boolean = false;

  private currentSymbol: SyntheticSymbol | null = null;
  private currentTimeframe: string = "H1";
  private currentCallbacks: MarketDataSubscriptionCallbacks | null = null;

  // Cached state for delta accumulation
  private cachedFuturesTelemetry: FuturesTelemetry | null = null;
  private lastKnownCandles: StandardCandle[] = [];
  private lastPingSentAt: number = 0;
  private currentLatencyMs: number = 24;

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /**
   * Subscribe to live data for an asset. Cleans up any existing socket/heartbeat.
   */
  public subscribe(
    symbol: SyntheticSymbol,
    timeframe: string,
    callbacks: MarketDataSubscriptionCallbacks
  ): () => void {
    // Teardown previous subscription
    this.unsubscribeCurrent();

    this.currentSymbol = symbol;
    this.currentTimeframe = timeframe;
    this.currentCallbacks = callbacks;
    this.reconnectAttempt = 0;
    this.isDestroyed = false;
    this.cachedFuturesTelemetry = null;
    this.lastKnownCandles = [];

    if (symbol.marketType === "CRYPTO_PERP") {
      this.initBybitFeed(symbol, timeframe, callbacks);
    } else {
      this.initDerivFeed(symbol, timeframe, callbacks);
    }

    // Return cleanup callback
    return () => {
      this.unsubscribeCurrent();
    };
  }

  public unsubscribeCurrent(): void {
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
                args: [`kline.${interval}.${bybitSym}`, `tickers.${bybitSym}`],
              })
            );
          } else {
            this.activeWs.send(JSON.stringify({ forget_all: "candles" }));
          }
        }
        this.activeWs.close();
      } catch {
        // Silently catch teardown failures
      }
      this.activeWs = null;
    }
  }

  // --------------------------------------------------------------------------
  // PROVIDER 1: Bybit V5 Linear (USDT Perpetual) Feed (Keyless)
  // --------------------------------------------------------------------------
  private async initBybitFeed(
    symbol: SyntheticSymbol,
    timeframe: string,
    callbacks: MarketDataSubscriptionCallbacks
  ) {
    const bybitSym = getBybitSymbol(symbol.ticker);
    const interval = timeframeToBybitInterval(timeframe);

    callbacks.onTelemetryChange({
      provider: "Bybit V5 Linear WS",
      status: "CONNECTING",
      latencyMs: this.currentLatencyMs,
      lastTickTime: Date.now(),
      symbol: symbol.ticker,
      timeframe,
      activeCandleCount: 0,
      futuresTelemetry: null,
    });

    // 1. REST Backfill: Fetch last 300 candles immediately
    try {
      const restUrl = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${bybitSym}&interval=${interval}&limit=300`;
      const res = await fetch(restUrl, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.retCode === 0 && Array.isArray(json.result?.list)) {
          // Bybit returns list in descending order [newest ... oldest]; reverse to ascending!
          const rawList = [...json.result.list].reverse();
          const normalized: StandardCandle[] = rawList.map((item: any, idx: number) => {
            const isLast = idx === rawList.length - 1;
            return {
              timestamp: Math.floor(Number(item[0]) / 1000),
              open: parseFloat(item[1]),
              high: parseFloat(item[2]),
              low: parseFloat(item[3]),
              close: parseFloat(item[4]),
              volume: parseFloat(item[5]) || 0,
              isClosed: !isLast, // all historical except potentially the currently forming one
            };
          });

          this.lastKnownCandles = normalized;
          callbacks.onHistory(normalized);

          callbacks.onTelemetryChange({
            provider: "Bybit V5 Linear WS",
            status: "CONNECTING",
            latencyMs: this.currentLatencyMs,
            lastTickTime: Date.now(),
            symbol: symbol.ticker,
            timeframe,
            activeCandleCount: normalized.length,
            futuresTelemetry: this.cachedFuturesTelemetry,
          });
        }
      }
    } catch (err) {
      console.warn("[Bybit REST Backfill] Failed to load REST history, continuing to WS:", err);
    }

    // 2. Open Bybit Public Linear WebSocket
    const wsUrl = "wss://stream.bybit.com/v5/public/linear";
    try {
      const ws = new WebSocket(wsUrl);
      this.activeWs = ws;

      ws.onopen = () => {
        if (this.isDestroyed || this.activeWs !== ws) return;
        this.reconnectAttempt = 0;

        // Subscribe to kline and tickers
        ws.send(
          JSON.stringify({
            op: "subscribe",
            args: [`kline.${interval}.${bybitSym}`, `tickers.${bybitSym}`],
          })
        );

        // Heartbeat: Send {"op": "ping"} every 20 seconds
        this.lastPingSentAt = Date.now();
        this.activeHeartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            this.lastPingSentAt = Date.now();
            ws.send(JSON.stringify({ op: "ping" }));
          }
        }, 20000);

        callbacks.onTelemetryChange({
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

          // Handle pong / latency
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

              // Update cached candles list
              this.updateLocalCandles(candle);
              callbacks.onCandleUpdate(candle);

              callbacks.onTelemetryChange({
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

          // B) Tickers stream parsing (Snapshot + Delta handling!)
          else if (msg.topic && msg.topic.startsWith("tickers.")) {
            const raw = msg.data;
            if (raw) {
              // Accumulate into cached telemetry
              const prev = this.cachedFuturesTelemetry || {
                symbol: symbol.ticker,
                fundingRate: 0.0001,
                nextFundingTime: Date.now() + 8 * 3600 * 1000,
                openInterest: 0,
                openInterestValue: 0,
                markPrice: raw.markPrice ? parseFloat(raw.markPrice) : symbol.defaultPrice,
                indexPrice: raw.indexPrice ? parseFloat(raw.indexPrice) : symbol.defaultPrice,
                volume24h: 0,
              };

              const updated: FuturesTelemetry = {
                symbol: symbol.ticker,
                fundingRate:
                  raw.fundingRate !== undefined
                    ? parseFloat(raw.fundingRate)
                    : prev.fundingRate,
                nextFundingTime:
                  raw.nextFundingTime !== undefined
                    ? Number(raw.nextFundingTime)
                    : prev.nextFundingTime,
                openInterest:
                  raw.openInterest !== undefined
                    ? parseFloat(raw.openInterest)
                    : prev.openInterest,
                openInterestValue:
                  raw.openInterestValue !== undefined
                    ? parseFloat(raw.openInterestValue)
                    : prev.openInterestValue,
                markPrice:
                  raw.markPrice !== undefined
                    ? parseFloat(raw.markPrice)
                    : prev.markPrice,
                indexPrice:
                  raw.indexPrice !== undefined
                    ? parseFloat(raw.indexPrice)
                    : prev.indexPrice,
                volume24h:
                  raw.volume24h !== undefined
                    ? parseFloat(raw.volume24h)
                    : prev.volume24h,
              };

              this.cachedFuturesTelemetry = updated;
              callbacks.onFuturesTelemetry?.(updated);

              callbacks.onTelemetryChange({
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
        callbacks.onTelemetryChange({
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
      callbacks.onTelemetryChange({
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

  // --------------------------------------------------------------------------
  // PROVIDER 2: Deriv Public WebSocket Feed (Synthetics, Forex & Commodities)
  // --------------------------------------------------------------------------
  private initDerivFeed(
    symbol: SyntheticSymbol,
    timeframe: string,
    callbacks: MarketDataSubscriptionCallbacks
  ) {
    const derivAppId =
      (import.meta as any).env?.VITE_DERIV_APP_ID ||
      (import.meta as any).env?.NEXT_PUBLIC_DERIV_APP_ID ||
      "1089";

    const derivSymbol = getDerivSymbolName(symbol.ticker);
    const granularity = timeframeToDerivGranularity(timeframe);

    const isForex = symbol.marketType === "FOREX";
    const providerLabel: "Deriv Public WS" = "Deriv Public WS";

    callbacks.onTelemetryChange({
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

        // Combined History + Live Stream Request
        ws.send(
          JSON.stringify({
            ticks_history: derivSymbol,
            adjust_start_time: 1,
            count: 300,
            end: "latest",
            start: 1,
            style: "candles",
            granularity: granularity,
            subscribe: 1,
          })
        );

        // Deriv Heartbeat: Send {"ping": 1} every 30 seconds
        this.lastPingSentAt = Date.now();
        this.activeHeartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            this.lastPingSentAt = Date.now();
            ws.send(JSON.stringify({ ping: 1 }));
          }
        }, 30000);

        callbacks.onTelemetryChange({
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

          // Handle ping/pong latency
          if (res.ping === "pong" || res.msg_type === "ping") {
            if (this.lastPingSentAt > 0) {
              this.currentLatencyMs = Math.max(15, Date.now() - this.lastPingSentAt);
            }
            return;
          }

          if (res.error) {
            console.warn("[Deriv WS Error]", res.error.message);
            // If forex weekend closed or invalid symbol, fallback gracefully
            callbacks.onTelemetryChange({
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

          // A) Historical Candles Backfill (300 bars)
          if (res.msg_type === "candles" && Array.isArray(res.candles)) {
            const normalized: StandardCandle[] = res.candles.map((c: any, idx: number) => {
              const isLast = idx === res.candles.length - 1;
              return {
                timestamp: Number(c.epoch),
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: 0,
                isClosed: !isLast,
              };
            });

            this.lastKnownCandles = normalized;
            callbacks.onHistory(normalized);

            callbacks.onTelemetryChange({
              provider: providerLabel,
              status: "CONNECTED",
              latencyMs: this.currentLatencyMs,
              lastTickTime: Date.now(),
              symbol: symbol.ticker,
              timeframe,
              activeCandleCount: normalized.length,
              futuresTelemetry: null,
            });
          }

          // B) Live OHLC Stream
          else if (res.msg_type === "ohlc" && res.ohlc) {
            const o = res.ohlc;
            const openTime = Number(o.open_time);

            // Check if candle finalized / new candle opened
            let isClosed = false;
            if (this.lastKnownCandles.length > 0) {
              const lastCandle = this.lastKnownCandles[this.lastKnownCandles.length - 1];
              if (openTime > lastCandle.timestamp) {
                // Previous candle has just finalized
                lastCandle.isClosed = true;
                callbacks.onCandleUpdate({ ...lastCandle });
              }
            }

            const liveCandle: StandardCandle = {
              timestamp: openTime,
              open: Number(o.open),
              high: Number(o.high),
              low: Number(o.low),
              close: Number(o.close),
              volume: 0,
              isClosed: isClosed,
            };

            this.updateLocalCandles(liveCandle);
            callbacks.onCandleUpdate(liveCandle);

            callbacks.onTelemetryChange({
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
        callbacks.onTelemetryChange({
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
      callbacks.onTelemetryChange({
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

  // Helper to maintain up to 300 chronological candles
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

  // Exponential backoff auto-reconnect (1s, 2s, 4s, 8s)
  private scheduleReconnect(feedType: "CRYPTO_PERP" | "DERIV") {
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      console.warn(`[MarketDataService] Max reconnection attempts (${this.maxReconnectAttempts}) reached.`);
      return;
    }

    const delay = Math.min(8000, Math.pow(2, this.reconnectAttempt) * 1000);
    this.reconnectAttempt++;

    this.reconnectTimeout = setTimeout(() => {
      if (this.currentSymbol && this.currentCallbacks) {
        if (feedType === "CRYPTO_PERP") {
          this.initBybitFeed(this.currentSymbol, this.currentTimeframe, this.currentCallbacks);
        } else {
          this.initDerivFeed(this.currentSymbol, this.currentTimeframe, this.currentCallbacks);
        }
      }
    }, delay);
  }
}

// Singleton helper export
export const marketDataService = MarketDataService.getInstance();
