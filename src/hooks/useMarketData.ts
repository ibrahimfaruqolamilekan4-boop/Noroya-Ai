import React, { useState, useEffect, useRef } from "react";
import { SyntheticSymbol } from "../data/symbols";
import {
  marketDataService,
  StandardCandle,
  FuturesTelemetry,
  FeedTelemetry,
} from "../services/MarketDataService";

export function useMarketData(symbol: SyntheticSymbol, timeframe: string) {
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

  // Keep ref to avoid stale closures in callbacks
  const candlesRef = useRef<StandardCandle[]>([]);

  useEffect(() => {
    setIsLoading(true);
    candlesRef.current = [];
    setCandles([]);
    setLatestCandle(null);
    setFuturesTelemetry(null);

    const unsubscribe = marketDataService.subscribe(symbol, timeframe, {
      onHistory: (historyCandles) => {
        candlesRef.current = historyCandles;
        setCandles(historyCandles);
        setIsLoading(false);
        if (historyCandles.length > 0) {
          setLatestCandle(historyCandles[historyCandles.length - 1]);
        }
      },
      onCandleUpdate: (newCandle) => {
        setLatestCandle(newCandle);

        setCandles((prev) => {
          if (prev.length === 0) {
            candlesRef.current = [newCandle];
            return [newCandle];
          }

          const copy = [...prev];
          const lastIdx = copy.length - 1;
          const last = copy[lastIdx];

          if (last.timestamp === newCandle.timestamp) {
            copy[lastIdx] = newCandle;
          } else if (newCandle.timestamp > last.timestamp) {
            copy[lastIdx] = { ...last, isClosed: true };
            copy.push(newCandle);
            if (copy.length > 350) {
              copy.shift();
            }
          }
          candlesRef.current = copy;
          return copy;
        });
      },
      onFuturesTelemetry: (telemetryData) => {
        setFuturesTelemetry(telemetryData);
      },
      onTelemetryChange: (feedTelemetry) => {
        setTelemetry(feedTelemetry);
        if (feedTelemetry.status === "CONNECTED") {
          setIsLoading(false);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [symbol.ticker, symbol.marketType, timeframe]);

  return {
    candles,
    latestCandle,
    futuresTelemetry,
    telemetry,
    isLoading,
  };
}
