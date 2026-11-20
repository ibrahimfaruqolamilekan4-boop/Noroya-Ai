import React, { useState, useEffect, useRef } from "react";
import { SyntheticSymbol } from "../data/symbols";
import {
  marketDataService,
  StandardCandle,
  FuturesTelemetry,
  FeedTelemetry,
  MultiTimeframeCandles,
  SmtReferenceData,
} from "../services/MarketDataService";
import { useSharedMarketDataContext } from "../context/MarketDataContext";

export function useMarketData(symbol: SyntheticSymbol, timeframe: string) {
  const shared = useSharedMarketDataContext();
  const isSharedMatch =
    shared !== null &&
    shared.symbol.ticker === symbol.ticker &&
    shared.symbol.marketType === symbol.marketType &&
    shared.timeframe === timeframe;

  // Fallback local state only used when hook is mounted outside MarketDataProvider
  const [candles, setCandles] = useState<StandardCandle[]>([]);
  const [latestCandle, setLatestCandle] = useState<StandardCandle | null>(null);
  const [futuresTelemetry, setFuturesTelemetry] = useState<FuturesTelemetry | null>(null);
  const [mtfCandles, setMtfCandles] = useState<MultiTimeframeCandles | null>(null);
  const [smtReference, setSmtReference] = useState<SmtReferenceData | null>(null);
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
  const candlesRef = useRef<StandardCandle[]>([]);

  useEffect(() => {
    if (isSharedMatch) return;

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
            if (copy.length > 350) copy.shift();
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
        if (feedTelemetry.status === "CONNECTED" || feedTelemetry.status === "ERROR") {
          setIsLoading(false);
        }
      },
    });

    Promise.all([
      marketDataService.fetchMultiTimeframeCandles(symbol).catch(() => null),
      marketDataService.fetchSmtReferenceData(symbol, timeframe).catch(() => null),
    ]).then(([mtf, smt]) => {
      if (mtf) setMtfCandles(mtf);
      if (smt) setSmtReference(smt);
    });

    return () => {
      unsubscribe();
    };
  }, [isSharedMatch, symbol.ticker, symbol.marketType, timeframe]);

  if (isSharedMatch && shared) {
    return {
      candles: shared.candles,
      latestCandle: shared.latestCandle,
      futuresTelemetry: shared.futuresTelemetry,
      telemetry: shared.telemetry,
      isLoading: shared.isLoading,
      mtfCandles: shared.mtfCandles,
      isMtfLoading: shared.isMtfLoading,
      smtReference: shared.smtReference,
    };
  }

  return {
    candles,
    latestCandle,
    futuresTelemetry,
    telemetry,
    isLoading,
    mtfCandles,
    isMtfLoading: false,
    smtReference,
  };
}
