import React, { useEffect, useState } from "react";
import { SyntheticSymbol } from "../data/symbols";
import { formatPriceBySymbol, getActiveKillzoneInfo } from "../lib/quantEngine";
import { Flame, Clock, Activity, Layers, ShieldAlert, TrendingUp, Gauge } from "lucide-react";

interface AssetMarketTelemetryProps {
  symbol: SyntheticSymbol;
  livePrice?: number | null;
}

export const AssetMarketTelemetry: React.FC<AssetMarketTelemetryProps> = ({ symbol, livePrice }) => {
  const [fundingCountdown, setFundingCountdown] = useState<string>("02:14:38");
  const [killzone, setKillzone] = useState(() => getActiveKillzoneInfo());

  useEffect(() => {
    const updateTimers = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMins = now.getUTCMinutes();
      const utcSecs = now.getUTCSeconds();

      // Next 8-hour funding settlement (00:00, 08:00, 16:00 UTC)
      const nextFundingHour = Math.ceil((utcHours + 0.0001) / 8) * 8;
      const hoursLeft = Math.max(0, nextFundingHour - 1 - utcHours);
      const minsLeft = 59 - utcMins;
      const secsLeft = 59 - utcSecs;

      setFundingCountdown(
        `${String(hoursLeft).padStart(2, "0")}:${String(minsLeft).padStart(2, "0")}:${String(secsLeft).padStart(2, "0")}`
      );
      setKillzone(getActiveKillzoneInfo());
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, []);

  const spot = livePrice && livePrice > 0 ? livePrice : symbol.defaultPrice;

  // 1. CRYPTO FUTURES & PERPETUALS (BYBIT / BINANCE STYLE)
  if (symbol.marketType === "CRYPTO_PERP" && symbol.futuresMetrics) {
    const fm = symbol.futuresMetrics;
    const longPct = Math.round((fm.longShortRatio / (1 + fm.longShortRatio)) * 100);
    const shortPct = 100 - longPct;

    return (
      <div className="bg-[#111622] border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold font-display text-white tracking-wide">
              {fm.exchange} Perpetual Futures Orderflow &amp; Liquidation Telemetry
            </h3>
          </div>
          <span className="text-[11px] font-mono text-cyan-400">
            {symbol.ticker} · Mark {formatPriceBySymbol(spot, symbol)}
          </span>
        </div>

        {/* Top 3 Futures Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[#0B0E14] border border-slate-800/90 rounded-lg p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Funding Rate (8H)</span>
              <Clock className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span
                className={`text-sm font-mono font-bold ${
                  fm.fundingRateNumeric < 0 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {fm.fundingRate}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{fundingCountdown}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {fm.fundingRateNumeric < 0
                ? "Negative funding: shorts paying longs (squeeze fuel)"
                : "Positive funding: longs paying shorts"}
            </p>
          </div>

          <div className="bg-[#0B0E14] border border-slate-800/90 rounded-lg p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Open Interest (OI)</span>
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm font-mono font-bold text-white">{fm.openInterestUsd}</span>
              <span className="text-[11px] font-mono text-cyan-400">{fm.oiDelta24h.split(" ")[0]}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 truncate">{fm.oiDelta24h}</p>
          </div>

          <div className="bg-[#0B0E14] border border-slate-800/90 rounded-lg p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>CVD &amp; L/S Ratio</span>
              <span className="font-mono text-white font-semibold">{fm.longShortRatio.toFixed(2)}</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-rose-500/30 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${longPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span className="text-emerald-400">Long {longPct}%</span>
              <span className="text-rose-400">Short {shortPct}%</span>
            </div>
          </div>
        </div>

        {/* Liquidation Heatmap / Leverage Tiers */}
        <div className="bg-[#0B0E14] border border-slate-800/90 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">
              Liquidation Heatmap Clusters (High-Leverage Stop Pools)
            </span>
            <span className="text-[10px] font-mono text-amber-400">
              CVD: {fm.cvdBias.replace("_", " ")}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-[#111622] border border-rose-500/20">
              <span className="text-[10px] text-slate-400 block">100x Short Liq (BSL)</span>
              <span className="text-rose-400 font-bold">
                {formatPriceBySymbol(fm.liquidationClusters.tier100xShort, symbol)}
              </span>
            </div>
            <div className="p-2 rounded bg-[#111622] border border-rose-500/30">
              <span className="text-[10px] text-slate-400 block">50x Short Liq (BSL)</span>
              <span className="text-rose-400 font-bold">
                {formatPriceBySymbol(fm.liquidationClusters.tier50xShort, symbol)}
              </span>
            </div>
            <div className="p-2 rounded bg-[#111622] border border-rose-500/40">
              <span className="text-[10px] text-slate-400 block">25x Short Liq (BSL)</span>
              <span className="text-rose-300 font-bold">
                {formatPriceBySymbol(fm.liquidationClusters.tier25xShort, symbol)}
              </span>
            </div>
            <div className="p-2 rounded bg-[#111622] border border-emerald-500/20">
              <span className="text-[10px] text-slate-400 block">100x Long Liq (SSL)</span>
              <span className="text-emerald-400 font-bold">
                {formatPriceBySymbol(fm.liquidationClusters.tier100xLong, symbol)}
              </span>
            </div>
            <div className="p-2 rounded bg-[#111622] border border-emerald-500/30">
              <span className="text-[10px] text-slate-400 block">50x Long Liq (SSL)</span>
              <span className="text-emerald-400 font-bold">
                {formatPriceBySymbol(fm.liquidationClusters.tier50xLong, symbol)}
              </span>
            </div>
            <div className="p-2 rounded bg-[#111622] border border-emerald-500/40">
              <span className="text-[10px] text-slate-400 block">25x Long Liq (SSL)</span>
              <span className="text-emerald-300 font-bold">
                {formatPriceBySymbol(fm.liquidationClusters.tier25xLong, symbol)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. SYNTHETIC INDICES (24/7 ALGORITHMICALLY GENERATED)
  if (symbol.marketType === "SYNTHETIC") {
    const sp = symbol.syntheticProfile || {
      constantVolatilityPct: "Constant Algorithmic Volatility",
      generationEngine: "Cryptographic RNG (Zero News Catalyst)",
      spikeDirection: "CONTINUOUS_GAUSSIAN",
      meanReversionSigma: "±2.5σ Volatility Band",
      preSpikeBaseRule: "Wait for SSL/BSL sweep outside 2.5σ band + displacement candle before entry",
    };

    return (
      <div className="bg-[#111622] border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold font-display text-white tracking-wide">
              Synthetic Index Algorithmic &amp; Tick-Spike Telemetry
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400">
            24/7 Zero-News Immunity
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block">Volatility Profile</span>
            <span className="font-mono font-bold text-white mt-1 block">{sp.constantVolatilityPct}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">{sp.generationEngine}</span>
          </div>
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block">Mean-Reversion / Spike Mode</span>
            <span className="font-mono font-bold text-cyan-400 mt-1 block">{sp.meanReversionSigma}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Mode: {sp.spikeDirection}</span>
          </div>
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] text-slate-400 block">ATR Displacement Unit</span>
            <span className="font-mono font-bold text-amber-400 mt-1 block">
              ±{symbol.atrDefault} pts
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Min Lot: {symbol.minLotSize}</span>
          </div>
        </div>

        <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
          <span className="text-[10px] font-mono uppercase text-cyan-400 font-semibold block mb-1">
            Quantitative Execution Rule:
          </span>
          {sp.preSpikeBaseRule}
        </div>
      </div>
    );
  }

  // 3. STANDARD FOREX PAIRS (MAJORS, MINORS, EXOTICS & METALS)
  return (
    <div className="bg-[#111622] border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold font-display text-white tracking-wide">
            Forex Institutional ICT Killzones &amp; Liquidity Sweep Monitor
          </h3>
        </div>
        <span className="text-[11px] font-mono text-cyan-400">
          {killzone.estTimeFormatted}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 block">Active ICT Session Window</span>
          <span
            className={`font-mono font-bold mt-1 block ${
              killzone.isActive ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {killzone.name}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Confluence Weight Bonus: +{killzone.weightBonus}%
          </span>
        </div>

        <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 block">Killzone Schedule (EST)</span>
          <span className="font-mono text-slate-200 mt-1 block text-[11px]">
            LDN: 02:00–05:00 · NY: 07:00–10:00
          </span>
          <span className="text-[10px] text-cyan-400 font-mono mt-0.5 block">
            Silver Bullet: 10:00–11:00 AM EST
          </span>
        </div>

        <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
          <span className="text-[10px] text-slate-400 block">Anti-Stop-Hunt ATR Buffer</span>
          <span className="font-mono font-bold text-emerald-400 mt-1 block">
            +{formatPriceBySymbol(symbol.atrDefault * 0.35, symbol)} ({symbol.subCategory || "Forex"})
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Placed behind displacement origin
          </span>
        </div>
      </div>
    </div>
  );
};
