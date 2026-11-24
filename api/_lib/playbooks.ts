// Asset-specific retail trading playbooks injected dynamically into the AI analyzer

export interface AssetPlaybook {
  assetClass: "GOLD" | "FOREX" | "INDICES" | "SYNTHETICS" | "CRYPTO";
  title: string;
  needsNewsCheck: boolean;
  newsQueryHint: string;
  rules: string[];
}

export function getAssetPlaybook(symbol: string, marketType?: string): AssetPlaybook {
  const s = (symbol || "").toUpperCase();
  const mt = (marketType || "").toUpperCase();

  if (s.includes("XAU") || s.includes("GOLD") || s.includes("XAG")) {
    return {
      assetClass: "GOLD",
      title: "Gold & Metals Retail Playbook",
      needsNewsCheck: true,
      newsQueryHint: "Gold XAUUSD USD CPI NFP FOMC Fed economic news today",
      rules: [
        "Gold frequently sweeps round psychological numbers ($XX00, $XX25, $XX50, $XX75) by $2-$6 before reversing; never place a Stop Loss right on a round number.",
        "Best clean moves happen during London Open (02:00-05:00 EST) and New York Open (08:00-11:00 EST); Asian session tends to range and set up stop-hunts.",
        "For Scalps on XAUUSD, protect SL with at least 1.0x ATR and lock in 50% at TP1 quickly because Gold snaps back fast.",
        "High-impact USD news (CPI, NFP, FOMC, Powell, Core PCE) causes $15-$40 instant whipsaws; warn the trader strongly if major USD data is due soon.",
      ],
    };
  }

  if (
    mt === "SYNTHETICS" ||
    s.startsWith("V") ||
    s.includes("BOOM") ||
    s.includes("CRASH") ||
    s.includes("STEP") ||
    s.includes("JUMP") ||
    s.includes("DEX") ||
    s.startsWith("R_") ||
    s.startsWith("1HZ")
  ) {
    const isBoomCrash = s.includes("BOOM") || s.includes("CRASH");
    return {
      assetClass: "SYNTHETICS",
      title: isBoomCrash
        ? "Boom & Crash Spike Playbook"
        : "Deriv Volatility & Synthetic Indices Playbook",
      needsNewsCheck: false,
      newsQueryHint: "",
      rules: isBoomCrash
        ? [
            "Synthetic indices run 24/7 on a mathematical volatility engine with ZERO fundamental news risk.",
            "On Boom (upward spikes) and Crash (downward spikes), NEVER widen a Stop Loss against spike direction — slippage during spikes can exceed tight stops.",
            "High-probability spike catches happen at clean H1/M15 support (Boom) or resistance (Crash) after a tight low-volatility base.",
            "When scalping ticks against the spike, take small quick profits and exit immediately before price reaches a major support/resistance zone.",
          ]
        : [
            "Volatility Indices (V75, V100, V25, Jump, Step) run 24/7 with constant engineered volatility and ZERO economic news catalysts.",
            "Respect pure price action, support/resistance, and Z-score stretch: when price stretches > 2.2 standard deviations from EMA20, avoid chasing breakouts and wait for a pullback.",
            "Always give V75/V100 slightly wider ATR stop padding (1.1x-1.6x ATR) because rapid 1-minute wicks routinely tag exact swing highs/lows before continuing.",
          ],
    };
  }

  if (
    mt === "CRYPTO" ||
    s.includes("BTC") ||
    s.includes("ETH") ||
    s.includes("SOL") ||
    s.includes("USDT") ||
    s.endsWith(".P") ||
    s.includes("BNB") ||
    s.includes("XRP") ||
    s.includes("DOGE")
  ) {
    return {
      assetClass: "CRYPTO",
      title: "Crypto Perpetual Futures Playbook",
      needsNewsCheck: true,
      newsQueryHint: `${s.replace("USDT.P", "").replace("USDT", "")} crypto BTC macro FOMC ETF news today`,
      rules: [
        "Check Funding Rate & Open Interest: crowded positive funding (> +0.03%) warns of a long squeeze flush; heavily negative funding (< -0.02%) fuels short squeezes.",
        "Crypto loves sweeping previous day high/low (PDH/PDL) and equal highs/lows to liquidate leveraged traders before trending cleanly.",
        "Weekend volume is thinner and prone to fake breakouts — prefer tighter scalp targets or reduced position size on Saturdays/Sundays.",
        "Always check BTC direction before trading altcoins (ETH, SOL, etc.); if BTC is dumping aggressively, avoid aggressive altcoin longs.",
      ],
    };
  }

  if (
    s.includes("US100") ||
    s.includes("NAS") ||
    s.includes("US30") ||
    s.includes("US500") ||
    s.includes("SPX") ||
    s.includes("GER40") ||
    s.includes("UK100")
  ) {
    return {
      assetClass: "INDICES",
      title: "Stock Indices (US100 / US30 / GER40) Playbook",
      needsNewsCheck: true,
      newsQueryHint: "US100 Nasdaq US30 S&P 500 CPI Fed Powell earnings economic calendar today",
      rules: [
        "Avoid entering market orders in the first 5-15 minutes of the NY Equity Open (09:30-09:45 EST) — wait for the opening range sweep and direction confirmation.",
        "VWAP and EMA20 pullbacks on M5/M15 offer the cleanest intraday scalps once the opening trend is established.",
        "Place Stop Losses safely behind the pullback swing plus ATR buffer to avoid routine index stop-runs.",
      ],
    };
  }

  return {
    assetClass: "FOREX",
    title: "Forex Pairs Retail Trading Playbook",
    needsNewsCheck: true,
    newsQueryHint: `${s} forex USD EUR GBP JPY CPI NFP central bank economic calendar today`,
    rules: [
      "Trade Forex pairs primarily during London (02:00-05:00 EST) and New York (07:00-11:00 EST) sessions when spreads are tight and trends follow through cleanly.",
      "Avoid entering right before high-impact central bank or inflation releases (CPI, NFP, FOMC, ECB, BoE) when spreads widen sharply.",
      "Respect the Higher Timeframe (H4/D1) trend for Normal Trades; only counter-trend scalp after a clear rejection wick at a major support/resistance level.",
      "Avoid chasing extended breakout candles — wait for a clean pullback toward EMA20 or the broken support/resistance level.",
    ],
  };
}
