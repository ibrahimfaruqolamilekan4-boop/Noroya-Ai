import React, { useState, useEffect } from "react";
import { SYNTHETIC_SYMBOLS, SyntheticSymbol } from "../data/symbols";
import { evaluateMultiFactorConfluence, formatPrice } from "../lib/quantEngine";
import {
  ArrowRight,
  Terminal,
  TrendingUp,
  Layers,
  ShieldCheck,
  Flame,
  Gauge,
  CheckCircle2,
  Smartphone,
  BarChart3,
} from "lucide-react";

interface LandingPageProps {
  onLaunchDashboard: (selectedSymbol?: SyntheticSymbol) => void;
}

const PREVIEW_TICKERS = ["EURUSD", "BTCUSDT.P", "V75", "XAUUSD", "SOLUSDT.P", "B1000"];

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchDashboard }) => {
  const [previewTicker, setPreviewTicker] = useState<string>("BTCUSDT.P");
  const [previewTimeframe, setPreviewTimeframe] = useState<string>("M15");
  const [tickOffset, setTickOffset] = useState<number>(0);

  // Subtle live market micro-tick simulation for the ticker strip
  useEffect(() => {
    const interval = setInterval(() => {
      setTickOffset((prev) => (prev + 1) % 1000);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const activePreviewSymbol =
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === previewTicker) || SYNTHETIC_SYMBOLS[0];

  const liveSimulatedPrice =
    activePreviewSymbol.defaultPrice *
    (1 + Math.sin(tickOffset * 0.7) * 0.0004);

  const previewQuant = evaluateMultiFactorConfluence(
    activePreviewSymbol,
    previewTimeframe
  );

  const tickerStripSymbols = [
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "EURUSD")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "GBPUSD")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "GBPJPY")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "XAUUSD")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "BTCUSDT.P")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "ETHUSDT.P")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "SOLUSDT.P")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "V75")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "B1000")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "C500")!,
    SYNTHETIC_SYMBOLS.find((s) => s.ticker === "STEP")!,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="flex items-center justify-between gap-8 px-6 md:px-10 py-4 border-b border-slate-800/80 bg-[#0B0E14]/95 backdrop-blur sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
          }}
          className="text-lg font-bold font-display tracking-tight text-white whitespace-nowrap shrink-0"
        >
          QuantSMC
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          <a
            href="#analyzer-preview"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Interactive Analyzer
          </a>
          <a
            href="#markets"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Multi-Asset Feeds
          </a>
          <a
            href="#confluence-engine"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Confluence Modules
          </a>
          <a
            href="#execution-architecture"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Execution Protocol
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onLaunchDashboard()}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <span>Launch Terminal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* LIVE MULTI-ASSET MARKET TICKER BAR */}
      <div className="border-b border-slate-800/80 bg-[#0E131B] px-4 md:px-10 py-2.5 overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max text-xs font-mono">
          {tickerStripSymbols.map((sym, idx) => {
            const deltaPct = (((idx % 3 === 0 ? 1 : -1) * ((idx * 0.37) % 1.8)) + Math.sin(tickOffset + idx) * 0.08).toFixed(2);
            const isPositive = !deltaPct.startsWith("-");
            const liveVal = sym.defaultPrice * (1 + Number(deltaPct) * 0.0005);
            return (
              <button
                key={sym.ticker}
                type="button"
                onClick={() => onLaunchDashboard(sym)}
                className="flex items-center gap-2 text-left hover:text-cyan-300 transition-colors cursor-pointer group"
                title={`Launch ${sym.name} in Terminal`}
              >
                <span className="font-bold text-slate-200 group-hover:text-cyan-400">
                  {sym.ticker}
                </span>
                <span className="text-slate-400">{formatPrice(liveVal, sym)}</span>
                <span className={isPositive ? "text-emerald-400" : "text-rose-400"}>
                  {isPositive ? `+${deltaPct}%` : `${deltaPct}%`}
                </span>
                {sym.marketType === "CRYPTO_PERP" && sym.futuresMetrics && (
                  <span className="text-[10px] text-amber-400">
                    FR {sym.futuresMetrics.fundingRate}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* HERO SECTION + INTERACTIVE AI ANALYZER PREVIEW */}
      <section className="max-w-7xl w-full mx-auto px-6 md:px-10 pt-12 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Column: Value Proposition & Zero-Login Direct CTAs */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono">
                <span>Zero-Login Institutional Terminal</span>
                <span aria-hidden="true">·</span>
                <span>Forex · Synthetics · Crypto Perps</span>
              </div>

              <h1
                className="font-display font-bold text-white tracking-tight leading-[1.12]"
                style={{ fontSize: "clamp(2.25rem, 3.8vw, 3.5rem)", textWrap: "balance" }}
              >
                Multi-Asset Quantitative SMC &amp; Orderflow Analyzer
              </h1>

              <p className="text-slate-300 text-base leading-relaxed max-w-[65ch]">
                Evaluate Standard Forex Pairs, 24/7 Synthetic Indices, and Bybit/Binance Crypto Perpetuals using a deterministic 5-Module Confluence Scoring System (0–100%). High-probability alerts trigger strictly when at least 3 of 5 institutional modules align.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onLaunchDashboard(activePreviewSymbol)}
                  className="px-6 py-3.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Terminal className="h-4 w-4" />
                  <span>Proceed to Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <a
                  href="#confluence-engine"
                  className="px-5 py-3.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-200 font-semibold text-sm transition-colors whitespace-nowrap"
                >
                  Inspect 5-Module Architecture
                </a>
              </div>

              <div className="pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-mono text-lg font-bold text-white block">3 Markets</span>
                  <span className="text-slate-400">Forex, Synthetics &amp; Perps</span>
                </div>
                <div>
                  <span className="font-mono text-lg font-bold text-cyan-400 block">0.705 OTE</span>
                  <span className="text-slate-400">Discount/Premium Gate</span>
                </div>
                <div>
                  <span className="font-mono text-lg font-bold text-emerald-400 block">≥ 1:2.5 R:R</span>
                  <span className="text-slate-400">ATR-Buffered Execution</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Live AI Quantitative Analyzer Preview */}
          <div
            id="analyzer-preview"
            className="lg:col-span-7 bg-[#111622] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Interactive Analyzer Preview</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-cyan-400">Live 5-Module Engine</span>
                </div>
                <h2 className="text-base font-bold font-display text-white mt-0.5">
                  {activePreviewSymbol.name}
                </h2>
              </div>

              {/* Timeframe Switcher */}
              <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-slate-800">
                {["M5", "M15", "H1", "H4"].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setPreviewTimeframe(tf)}
                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                      previewTimeframe === tf
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Asset Class Selector Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {PREVIEW_TICKERS.map((tk) => {
                const symItem = SYNTHETIC_SYMBOLS.find((s) => s.ticker === tk);
                if (!symItem) return null;
                const isSelected = previewTicker === tk;
                return (
                  <button
                    key={tk}
                    type="button"
                    onClick={() => setPreviewTicker(tk)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer border ${
                      isSelected
                        ? "bg-cyan-950/60 border-cyan-400 text-cyan-300"
                        : "bg-[#0B0E14] border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {symItem.ticker}
                  </button>
                );
              })}
            </div>

            {/* Live Confluence Summary Banner */}
            <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-emerald-400">
                    {previewQuant.directionalBias}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {previewQuant.confluenceScorePct}% Confluence ({previewQuant.alignedModulesCount}/5 Modules)
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Spot: {formatPrice(liveSimulatedPrice, activePreviewSymbol)}
                </span>
              </div>

              <p className="text-xs font-mono text-slate-300 leading-relaxed">
                {previewQuant.confluenceFormulaBanner}
              </p>

              {/* Key Execution Coordinates */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="p-2.5 rounded bg-[#111622] border border-slate-800/90">
                  <span className="text-[10px] text-slate-400 block">0.705 OTE Entry</span>
                  <span className="text-xs font-mono font-bold text-cyan-400 mt-0.5 block">
                    {formatPrice(previewQuant.executionCard.optimalEntry705, activePreviewSymbol)}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[#111622] border border-slate-800/90">
                  <span className="text-[10px] text-slate-400 block">Invalidation SL</span>
                  <span className="text-xs font-mono font-bold text-rose-400 mt-0.5 block">
                    {formatPrice(previewQuant.executionCard.invalidationSL, activePreviewSymbol)}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[#111622] border border-slate-800/90">
                  <span className="text-[10px] text-slate-400 block">TP2 (1.618 Fib)</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 mt-0.5 block">
                    {formatPrice(previewQuant.executionCard.tp2_1618, activePreviewSymbol)}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-[#111622] border border-slate-800/90">
                  <span className="text-[10px] text-slate-400 block">Calculated R:R</span>
                  <span className="text-xs font-mono font-bold text-amber-400 mt-0.5 block">
                    {previewQuant.executionCard.riskRewardRatio}
                  </span>
                </div>
              </div>
            </div>

            {/* Module Alignment Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {previewQuant.modules.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  className="p-2.5 rounded-lg bg-[#0B0E14] border border-slate-800/80 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 truncate">{m.title}</span>
                  </div>
                  <span className="font-mono text-cyan-400 font-semibold shrink-0">
                    {m.score}/{m.maxScore}
                  </span>
                </div>
              ))}
            </div>

            {/* Direct Action Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Full interactive chart &amp; AI screenshot scanner ready
              </span>
              <button
                type="button"
                onClick={() => onLaunchDashboard(activePreviewSymbol)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>Analyze {activePreviewSymbol.ticker} in Terminal</span>
                <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* MULTI-ASSET MARKET EXPANSION SECTION */}
      <section id="markets" className="border-t border-slate-800/80 bg-[#0E131B] py-16 px-6 md:px-10">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-mono text-cyan-400">Multi-Asset Coverage</div>
            <h2 className="text-2xl md:text-3xl font-bold font-display text-white">
              Three Specialized Quantitative Market Engines
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Each asset class exhibits distinct liquidity distribution and microstructure mechanics. Select any market below to launch directly into the analyzer terminal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Market 1: Standard Forex Pairs */}
            <div className="bg-[#111622] border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-cyan-400">01. Standard Forex &amp; Metals</span>
                  <Layers className="h-4 w-4 text-cyan-400" />
                </div>
                <h3 className="text-lg font-bold font-display text-white">
                  Major, Minor &amp; Exotic Pairs
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Engineered around ICT London Open (02:00–05:00 EST), NY Open (07:00–10:00 EST), and Silver Bullet (10:00–11:00 EST) Killzones with Asian session Judas swing detection and SMT correlation filtering.
                </p>
                <div className="pt-2 space-y-1.5 text-xs font-mono text-slate-300">
                  <div>· EUR/USD · GBP/USD · USD/JPY · XAU/USD</div>
                  <div>· GBP/JPY · EUR/GBP · AUD/USD · USD/ZAR</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onLaunchDashboard(SYNTHETIC_SYMBOLS.find((s) => s.ticker === "EURUSD"))
                }
                className="w-full py-2.5 px-4 rounded-lg bg-[#0B0E14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open Forex Terminal</span>
                <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
              </button>
            </div>

            {/* Market 2: Synthetic Indices */}
            <div className="bg-[#111622] border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-emerald-400">02. 24/7 Synthetic Indices</span>
                  <Gauge className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold font-display text-white">
                  Volatility, Boom/Crash &amp; Step
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Calibrated for constant algorithmic volatility profiles, zero fundamental news catalysts, pre-spike consolidation bases on Boom 1000 / Crash 500, and ±2.5σ mean-reversion bands on Volatility 75.
                </p>
                <div className="pt-2 space-y-1.5 text-xs font-mono text-slate-300">
                  <div>· Volatility 75 · Volatility 100 · Step Index</div>
                  <div>· Boom 1000 · Boom 500 · Crash 1000 · Crash 500</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onLaunchDashboard(SYNTHETIC_SYMBOLS.find((s) => s.ticker === "V75"))
                }
                className="w-full py-2.5 px-4 rounded-lg bg-[#0B0E14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open Synthetics Terminal</span>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
              </button>
            </div>

            {/* Market 3: Crypto Futures & Perpetuals */}
            <div className="bg-[#111622] border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400">03. Crypto Perpetuals</span>
                  <Flame className="h-4 w-4 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold font-display text-white">
                  Bybit &amp; Binance Linear Perps
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Integrates 8-hour Funding Rates &amp; countdown timers, Open Interest (OI) delta flushes, Long/Short ratios, CVD divergences, and 25x/50x/100x Liquidation Heatmap clusters.
                </p>
                <div className="pt-2 space-y-1.5 text-xs font-mono text-slate-300">
                  <div>· BTCUSDT.P · ETHUSDT.P · SOLUSDT.P</div>
                  <div>· BNBUSDT.P · XRPUSDT.P · SUIUSDT.P</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onLaunchDashboard(SYNTHETIC_SYMBOLS.find((s) => s.ticker === "BTCUSDT.P"))
                }
                className="w-full py-2.5 px-4 rounded-lg bg-[#0B0E14] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Open Crypto Perps Terminal</span>
                <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5-MODULE QUANTITATIVE CONFLUENCE ARCHITECTURE (BENTO GRID) */}
      <section id="confluence-engine" className="py-16 px-6 md:px-10 max-w-7xl mx-auto space-y-10">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs font-mono text-cyan-400">Multi-Factor Scoring System (0–100%)</div>
          <h2 className="text-2xl md:text-3xl font-bold font-display text-white">
            Five Institutional Confluence Modules
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            A setup only triggers a High Probability execution alert when at least 3 of the 5 quantitative modules align and Risk-to-Reward exceeds 1:2.5.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-[#111622] border border-slate-800 rounded-xl p-6 space-y-3">
            <span className="text-xs font-mono text-cyan-400">01. Smart Money Concepts (SMC) &amp; ICT Framework</span>
            <h3 className="text-lg font-bold font-display text-white">
              Multi-Timeframe BOS, CHoCH,MSS &amp; Liquidity Sweeps
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated structural mapping across HTF (4H/1D) and LTF (15M/5M/1M). Identifies unmitigated Order Blocks (OB), Fair Value Gaps (FVG), Breaker Blocks, and Equal High/Low liquidity pools (BSL/SSL), requiring a confirmed Judas Swing sweep before entry.
            </p>
          </div>

          <div className="bg-[#111622] border border-slate-800 rounded-xl p-6 space-y-3">
            <span className="text-xs font-mono text-emerald-400">02. Advanced Fibonacci Confluence</span>
            <h3 className="text-lg font-bold font-display text-white">
              0.705 OTE &amp; Equilibrium Filter
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strictly filters for Longs in Discount (&lt;0.50) and Shorts in Premium (&gt;0.50), highlighting the 0.618–0.786 OTE zone (0.705 sweet spot) and projecting 1.272, 1.618, and 2.0 extensions for TP1–TP3.
            </p>
          </div>

          <div className="bg-[#111622] border border-slate-800 rounded-xl p-6 space-y-3">
            <span className="text-xs font-mono text-amber-400">03. Institutional Price Action</span>
            <h3 className="text-lg font-bold font-display text-white">
              POI-Gated Candlestick Triggers
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Detects Engulfing volume expansions, Liquidity-Sweep Pin Bars, and Three-Bar Reversals occurring strictly inside HTF Point of Interest zones while rejecting mid-range noise.
            </p>
          </div>

          <div className="bg-[#111622] border border-slate-800 rounded-xl p-6 space-y-3">
            <span className="text-xs font-mono text-cyan-400">04. Asset-Specific Quantitative Filters</span>
            <h3 className="text-lg font-bold font-display text-white">
              CVD Divergences, OI Flushes &amp; Tick Bases
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Combines SMC with Cumulative Volume Delta (CVD) and Open Interest liquidation flushes on Crypto Perps, and pre-spike consolidation bases + volatility bands on Synthetics.
            </p>
          </div>

          <div id="execution-architecture" className="bg-[#111622] border border-slate-800 rounded-xl p-6 space-y-3">
            <span className="text-xs font-mono text-emerald-400">05. Dynamic Risk &amp; Execution Output</span>
            <h3 className="text-lg font-bold font-display text-white">
              Structured Trade Card (Min 1:2.5 R:R)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Outputs exact Entry Zone, ATR-buffered structural Stop Loss, and tiered TP1/TP2/TP3 targets with automated position sizing and trade journaling.
            </p>
          </div>
        </div>

        {/* Final Conversion CTA Bar */}
        <div className="bg-[#111622] border border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold font-display text-white">
              Ready to Execute Quantitative Multi-Asset Analysis?
            </h3>
            <p className="text-xs text-slate-400">
              Immediate access to the live chart terminal, 5-module confluence scanner, risk calculator, and trade journal — no login required.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLaunchDashboard()}
            className="px-6 py-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Launch Terminal (/dashboard)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* QUIET FOOTER */}
      <footer className="mt-auto border-t border-slate-800/80 py-6 px-6 md:px-10 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>QuantSMC Institutional Multi-Asset Analyzer · Standalone PWA Terminal</span>
        <span>Forex · Synthetic Indices · Crypto Futures (Bybit/Perpetuals)</span>
      </footer>
    </div>
  );
};
