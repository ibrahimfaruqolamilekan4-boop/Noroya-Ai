import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { SyntheticSymbol } from "../data/symbols";
import {
  marketDataService,
  StandardCandle,
  FuturesTelemetry,
  FeedTelemetry,
  MultiTimeframeCandles,
  SmtReferenceData,
} from "../services/MarketDataService";

export interface SharedMarketDataState {
  symbol: SyntheticSymbol;
  timeframe: string;
  candles: StandardCandle[];
  latestCandle: StandardCandle | null;
  futuresTelemetry: FuturesTelemetry | null;
  telemetry: FeedTelemetry;
  isLoading: boolean;
  mtfCandles: MultiTimeframeCandles | null;
  isMtfLoading: boolean;
  smtReference: SmtReferenceData | null;
}

const MarketDataContext = createContext<SharedMarketDataState | null>(null);

interface MarketDataProviderProps {
  symbol: SyntheticSymbol;
  timeframe: string;
  children: React.ReactNode;
}

export const MarketDataProvider: React.FC<MarketDataProviderProps> = ({
  symbol,
  timeframe,
  children,
}) => {
  const [candles, setCandles] = useState<StandardCandle[]>([]);
  const [latestCandle, setLatestCandle] = useState<StandardCandle | null>(null);
  const [futuresTelemetry, setFuturesTelemetry] = useState<FuturesTelemetry | null>(null);
  const [telemetry, setTelemetry] = useState<FeedTelemetry>({
    provider: symbol.marketType === "CRYPTO_PERP" ? "Bybit V5 Linear WS" : "Deriv Public WS",
    status: "CONNECTING",
    latencyMs: 24,
    lastTickTime: Date.now(),
    symbol: symbol.ticker,
    timeframe,
    activeCandleCount: 0,
    futuresTelemetry: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mtfCandles, setMtfCandles] = useState<MultiTimeframeCandles | null>(null);
  const [isMtfLoading, setIsMtfLoading] = useState<boolean>(false);
  const [smtReference, setSmtReference] = useState<SmtReferenceData | null>(null);

  const activeRequestIdRef = useRef<number>(0);

  useEffect(() => {
    const reqId = ++activeRequestIdRef.current;

    setIsLoading(true);
    setCandles([]);
    setLatestCandle(null);
    setFuturesTelemetry(null);
    setSmtReference(null);

    const unsubscribe = marketDataService.subscribe(symbol, timeframe, {
      onHistory: (historyCandles) => {
        if (activeRequestIdRef.current !== reqId) return;
        setCandles(historyCandles);
        setIsLoading(false);
        if (historyCandles.length > 0) {
          setLatestCandle(historyCandles[historyCandles.length - 1]);
        }
      },
      onCandleUpdate: (newCandle) => {
        if (activeRequestIdRef.current !== reqId) return;
        setLatestCandle(newCandle);
        setCandles((prev) => {
          if (prev.length === 0) return [newCandle];
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          const last = copy[lastIdx];

          if (last.timestamp === newCandle.timestamp) {
            copy[lastIdx] = newCandle;
          } else if (newCandle.timestamp > last.timestamp) {
            copy[lastIdx] = { ...last, isClosed: true };
            copy.push(newCandle);
            if (copy.length > 350) copy.shift();
          }
          return copy;
        });
      },
      onFuturesTelemetry: (telemetryData) => {
        if (activeRequestIdRef.current !== reqId) return;
        setFuturesTelemetry(telemetryData);
      },
      onTelemetryChange: (feedTelemetry) => {
        if (activeRequestIdRef.current !== reqId) return;
        setTelemetry(feedTelemetry);
        if (feedTelemetry.status === "CONNECTED" || feedTelemetry.status === "ERROR") {
          setIsLoading(false);
        }
      },
    });

    // Fetch real MTF (D1 + H4) candles & paired SMT Divergence candles in parallel
    setIsMtfLoading(true);
    Promise.all([
      marketDataService.fetchMultiTimeframeCandles(symbol).catch(() => null),
      marketDataService.fetchSmtReferenceData(symbol, timeframe).catch(() => null),
    ]).then(([mtf, smt]) => {
      if (activeRequestIdRef.current !== reqId) return;
      if (mtf) setMtfCandles(mtf);
      if (smt) setSmtReference(smt);
      setIsMtfLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [symbol.ticker, symbol.marketType, timeframe]);

  return (
    <MarketDataContext.Provider
      value={{
        symbol,
        timeframe,
        candles,
        latestCandle,
        futuresTelemetry,
        telemetry,
        isLoading,
        mtfCandles,
        isMtfLoading,
        smtReference,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
};

export function useSharedMarketDataContext(): SharedMarketDataState | null {
  return useContext(MarketDataContext);
}
