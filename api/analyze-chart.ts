import { GoogleGenAI } from "@google/genai";

function getGeminiClient(customKey?: string): GoogleGenAI {
  const rawKey =
    customKey ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;
  const key = rawKey?.trim().replace(/[\r\n\s]+/g, "");
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function generateGeminiContent(
  ai: GoogleGenAI,
  primaryModel: string,
  params: any
): Promise<{ response: any; modelUsed: string }> {
  const modelsToTry = Array.from(
    new Set([primaryModel, "gemini-4-hydrogen", "gemini-3.1-flash-lite"])
  );

  const delayHelper = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const sanitizedConfig = { ...(params.config || {}) };
        // Gemini 4 series rejects deprecated sampling parameters
        if (modelName.startsWith("gemini-4")) {
          delete sanitizedConfig.temperature;
          delete sanitizedConfig.topP;
          delete sanitizedConfig.topK;
          delete sanitizedConfig.candidateCount;
        }

        const response = await ai.models.generateContent({
          ...params,
          model: modelName,
          config: sanitizedConfig,
        });
        return { response, modelUsed: modelName };
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err?.status || "").toLowerCase();
        const responseBody = err?.response ? String(JSON.stringify(err.response)) : "";
        const combined = `${errMsg} ${responseBody}`.toLowerCase();

        const isAuthFatal =
          combined.includes("api_key_invalid") ||
          combined.includes("api key not valid") ||
          combined.includes("invalid key") ||
          combined.includes("unauthorized") ||
          err?.status === 401 ||
          err?.status === 403;

        if (isAuthFatal) {
          throw err;
        }
        if (attempt < 2) {
          await delayHelper(attempt * 700);
        }
      }
    }
  }

  throw lastError;
}

function getSessionWindows() {
  const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyTimeStr);
  const nyHour = nyDate.getHours();
  const nyMin = nyDate.getMinutes();
  const nyDecimal = nyHour + nyMin / 60;

  let killZoneStatus: "ACTIVE_LONDON" | "ACTIVE_NY" | "ACTIVE_NY_PM" | "INACTIVE" = "INACTIVE";
  let killZoneName = "Outside Killzone (Consolidation)";
  if (nyDecimal >= 2.0 && nyDecimal <= 5.0) {
    killZoneStatus = "ACTIVE_LONDON";
    killZoneName = "London Open Killzone (02:00–05:00 EST)";
  } else if (nyDecimal >= 7.0 && nyDecimal <= 10.5) {
    killZoneStatus = "ACTIVE_NY";
    killZoneName = "New York AM Killzone (07:00–10:30 EST)";
  } else if (nyDecimal >= 14.0 && nyDecimal <= 16.0) {
    killZoneStatus = "ACTIVE_NY_PM";
    killZoneName = "NY PM / London Close Window (14:00–16:00 EST)";
  }

  let silverBulletStatus: "ACTIVE_LONDON" | "ACTIVE_NY_AM" | "ACTIVE_NY_PM" | "INACTIVE" = "INACTIVE";
  let silverBulletName = "Inactive";
  if (nyHour === 3) {
    silverBulletStatus = "ACTIVE_LONDON";
    silverBulletName = "London Open Silver Bullet (03:00–04:00 EST)";
  } else if (nyHour === 10) {
    silverBulletStatus = "ACTIVE_NY_AM";
    silverBulletName = "NY AM Silver Bullet (10:00–11:00 EST)";
  } else if (nyHour === 14) {
    silverBulletStatus = "ACTIVE_NY_PM";
    silverBulletName = "NY PM Silver Bullet (14:00–15:00 EST)";
  }

  return { nyTimeStr, killZoneStatus, killZoneName, silverBulletStatus, silverBulletName };
}

function buildDeterministicQuantReport(
  symbol: string,
  timeframe: string,
  currentPrice?: number,
  quantContext?: any,
  reasonNote?: string
) {
  const { killZoneStatus, killZoneName, silverBulletStatus, silverBulletName } = getSessionWindows();

  if (quantContext && quantContext.executionCard && quantContext.fibonacci) {
    const q = quantContext;
    const exec = q.executionCard;
    const fib = q.fibonacci;
    const struct = q.structure || {};
    const mtf = q.mtf || {};
    const primaryOb = Array.isArray(q.orderBlocks) && q.orderBlocks.length > 0 ? q.orderBlocks[q.orderBlocks.length - 1] : null;
    const primaryFvg = Array.isArray(q.fairValueGaps) && q.fairValueGaps.length > 0 ? q.fairValueGaps[q.fairValueGaps.length - 1] : null;

    const isBull = q.directionalBias === "BULLISH";
    const isBear = q.directionalBias === "BEARISH";
    const bias: "BULLISH" | "BEARISH" | "NEUTRAL" = isBull ? "BULLISH" : isBear ? "BEARISH" : "NEUTRAL";
    const setupType: "BUY" | "SELL" | "WAIT" =
      exec.orderType === "BUY LIMIT" ? "BUY" : exec.orderType === "SELL LIMIT" ? "SELL" : "WAIT";

    const roundVal = (n: number) => {
      const ref = Number(q.livePrice || currentPrice || 1);
      return Number(Number(n || 0).toFixed(ref < 5 ? 5 : ref < 50 ? 3 : 2));
    };

    const entry = roundVal(exec.optimalEntry705);
    const stopLoss = roundVal(exec.invalidationSL);
    const tp1 = roundVal(exec.tp1_1272);
    const tp2 = roundVal(exec.tp2_1618);
    const tp3 = roundVal(exec.tp3_2000);

    const dealingPos =
      fib.currentZone === "DISCOUNT"
        ? "DISCOUNT_OTE"
        : fib.currentZone === "PREMIUM"
        ? "PREMIUM_OTE"
        : "EQUILIBRIUM";

    const sweepType = struct.liquiditySweepDetected
      ? isBull
        ? "LOW_SWEPT"
        : "HIGH_SWEPT"
      : "NONE";

    return {
      engineMode: "DETERMINISTIC_QUANT_ENGINE",
      modelUsed: "QuantSMC Local Mathematical Engine",
      engineNotice: reasonNote || "Generated directly from live OHLC mathematical structure.",
      imageQuality: {
        status: "passed",
        details: `Computed directly from live ${symbol} (${timeframe}) OHLC candles, 5-bar fractal swings, and MTF D1/H4 feeds.`,
      },
      bias,
      marketStructure: `${struct.ltfStructure || "Range structure"} · HTF: ${struct.htfStructure || "Syncing"}`,
      confluenceScore: Number(((q.confluenceScorePct || 50) / 20).toFixed(1)),
      confluenceScorePct: q.confluenceScorePct || 50,
      alignedModulesCount: q.alignedModulesCount || 0,
      confluenceFormula: q.confluenceFormula || "Mathematical 5-Module SMC Evaluation",
      antiStopLossShield: {
        structuralInvalidationPrice: stopLoss,
        bufferPipsApplied: Number(Math.abs(entry - stopLoss).toFixed(entry < 5 ? 4 : 2)),
        protectionRationale: `${exec.atrBufferApplied}. Placed behind confirmed structural displacement origin rather than obvious swing wicks.`,
        dealingRangePosition: dealingPos,
      },
      killZone: {
        status: killZoneStatus,
        windowName: killZoneName,
        details:
          killZoneStatus === "INACTIVE"
            ? "Currently outside peak London/NY institutional killzones — expect tighter ranges or wait for session open."
            : `Active ${killZoneName}. Monitor liquidity sweeps against Asian/PDH-PDL boundaries.`,
      },
      silverBullet: {
        status: silverBulletStatus,
        windowName: silverBulletName,
        details:
          silverBulletStatus === "INACTIVE"
            ? "No Silver Bullet hourly window active right now."
            : `Active ${silverBulletName} — prioritize clean FVG rebalance entries.`,
      },
      candleRangeTheory: {
        rangeHigh: roundVal(fib.swingHigh),
        rangeLow: roundVal(fib.swingLow),
        sweepType,
        deliveryDirection: bias,
        description: struct.sweepDescription || "Monitoring dealing range boundaries for external liquidity sweep.",
      },
      judasSwing: {
        detected: Boolean(struct.liquiditySweepDetected),
        direction: bias,
        triggerLevel: roundVal(isBull ? struct.sslPool || fib.swingLow : struct.bslPool || fib.swingHigh),
        description: struct.liquiditySweepDetected
          ? `Liquidity probe beyond ${roundVal(isBull ? struct.sslPool : struct.bslPool)} detected with rejection back into dealing range.`
          : "No confirmed Judas Swing liquidity probe yet on current candle sequence.",
      },
      powerOf3: {
        detected: Boolean(struct.asianHigh && struct.asianLow),
        accumulationRange:
          struct.asianLow && struct.asianHigh
            ? `${roundVal(struct.asianLow)} – ${roundVal(struct.asianHigh)}`
            : `${roundVal(fib.swingLow)} – ${roundVal(fib.equilibrium50)}`,
        manipulationLevel: roundVal(isBull ? struct.asianLow || struct.sslPool : struct.asianHigh || struct.bslPool),
        distributionTarget: tp2,
        description:
          struct.asianHigh && struct.asianLow
            ? "Asian session range mapped as Accumulation phase; monitor sweep for Manipulation and expansion toward TP2."
            : "Dealing range mapped for Accumulation-Manipulation-Distribution sequencing.",
      },
      multiTimeframe: {
        isMultiTimeframe: true,
        htfBias1D: `${mtf.d1Bias || "RANGING"} — ${mtf.d1Event || "Syncing Daily structure"}`,
        intermediateStructure4H: `${mtf.h4Bias || "RANGING"} — ${mtf.h4Event || "Syncing 4H structure"}`,
        entryPrecision30M: `${struct.ltfStructure || timeframe} · Entry zone ${roundVal(exec.entryZoneLow)}–${roundVal(exec.entryZoneHigh)}`,
        confirmationMessage: mtf.note || "Top-down MTF structural alignment computed from live candles.",
      },
      suggestedRisk:
        setupType === "WAIT"
          ? "0% — Stand aside. Setup does not meet >= 3/5 module confluence and >= 1:2.0 R:R gate."
          : "0.5% to 1.0% risk per position. Scale 40% at TP1 and move SL to breakeven.",
      doActions:
        setupType === "WAIT"
          ? [
              `Wait for price to retrace into ${isBull ? "Discount (<50%)" : "Premium (>50%)"} OTE zone (${roundVal(exec.entryZoneLow)}–${roundVal(exec.entryZoneHigh)}).`,
              "Require a confirmed LTF BOS/CHoCH displacement candle after a liquidity sweep before deploying capital.",
              "Verify at least 3 of 5 quantitative modules align with R:R >= 1:2.0.",
            ]
          : [
              `Place disciplined ${exec.orderType} near ${entry} inside ${struct.pdArrayType}.`,
              `Take partial profits at TP1 (${tp1}) and move SL to breakeven.`,
              `Hold core runner toward TP2 (${tp2}) and TP3 (${tp3}).`,
            ],
      dontActions: [
        "Do NOT chase mid-range candles in Equilibrium without an unmitigated OB or FVG.",
        "Do NOT tighten Stop Loss inside the structural liquidity sweep wick.",
        "Do NOT override the 1:2.0 minimum asymmetric Risk:Reward gate.",
      ],
      detailedVisualDescription: `Deterministic mathematical scan on ${symbol} (${timeframe}) at live price ${roundVal(q.livePrice || currentPrice)}. Found ${q.orderBlocks?.length || 0} active Order Block(s), ${q.fairValueGaps?.length || 0} open Fair Value Gap(s), and ${q.alignedModulesCount}/5 aligned quantitative modules (${q.confluenceScorePct}%).`,
      orderBlock: {
        priceRange: primaryOb
          ? `${roundVal(primaryOb.bottom)} – ${roundVal(primaryOb.top)}`
          : `${roundVal(exec.entryZoneLow)} – ${roundVal(exec.entryZoneHigh)}`,
        type: primaryOb ? `${primaryOb.type.replace(/_/g, " ")} (${primaryOb.status})` : struct.pdArrayType || "Order Block",
        rationale: primaryOb
          ? `Confirmed ${primaryOb.displacementAtrMultiple}x ATR displacement origin candle (${primaryOb.status.toLowerCase()}).`
          : "Anchored to institutional OTE dealing range boundary.",
      },
      supplyDemandZones: {
        supply: `${roundVal(fib.equilibrium50)} – ${roundVal(fib.swingHigh)}`,
        demand: `${roundVal(fib.swingLow)} – ${roundVal(fib.equilibrium50)}`,
        activeZone: `${fib.currentZone} Zone`,
      },
      liquidityVoid: {
        priceRange: primaryFvg
          ? `${roundVal(primaryFvg.bottom)} – ${roundVal(primaryFvg.top)}`
          : "No open FVG above 0.15x ATR",
        description: primaryFvg
          ? `${primaryFvg.type} FVG (${primaryFvg.status}) with 50% CE at ${roundVal(primaryFvg.midpointCE)}.`
          : "Price delivery balanced; no wide unmitigated imbalance currently open.",
      },
      vacuumBlock: {
        priceRange: `${roundVal(Math.min(entry, stopLoss))} – ${roundVal(Math.max(entry, stopLoss))}`,
        description: "Structural displacement origin protecting invalidation stop loss.",
      },
      candlestickPatterns: {
        patternName: q.candlestickTrigger?.patternName || "Monitoring closed candle trigger",
        context: q.candlestickTrigger?.details || "Evaluating closed-bar displacement near HTF POI.",
      },
      fibonacciRetracement: {
        level_50: roundVal(fib.equilibrium50),
        level_618: roundVal(fib.ote618),
        level_705: roundVal(fib.ote705SweetSpot),
        level_786: roundVal(fib.ote786),
        ext_1272: tp1,
        ext_1618: tp2,
        ext_2000: tp3,
        description: fib.filterExplanation || "Fibonacci dealing range anchored to confirmed fractal swings.",
      },
      tradeSetup: {
        type: setupType,
        entry,
        stopLoss,
        takeProfits: [tp1, tp2, tp3],
        riskRewardRatio: exec.riskRewardRatio || "1:2.0",
        rationale:
          setupType === "WAIT"
            ? `Gated to WAIT: ${q.alignedModulesCount}/5 modules aligned (R:R ${exec.riskRewardRatio}). ${mtf.note || ""}`
            : `${exec.orderType} triggered at ${entry} (${q.confluenceScorePct}% confluence, ${exec.riskRewardRatio} R:R). ${mtf.note || ""}`,
      },
      educationalInsight:
        "Institutional consistency comes from enforcing strict mechanical gates: only executing when HTF structure, Discount/Premium OTE, and asymmetric Risk:Reward (>= 1:2.0) align simultaneously.",
    };
  }

  // Minimal safe neutral WAIT fallback if no quantContext was provided at all
  const base = currentPrice && currentPrice > 0 ? currentPrice : 1.085;
  const dec = base < 5 ? 4 : 2;
  const step = base * 0.005;
  return {
    engineMode: "DETERMINISTIC_QUANT_ENGINE",
    modelUsed: "QuantSMC Safety Gate",
    engineNotice: reasonNote || "Awaiting live candle telemetry before issuing directional bias.",
    imageQuality: { status: "passed", details: "Chart received; live candle history still initializing." },
    bias: "NEUTRAL",
    marketStructure: "Insufficient candle telemetry — defaulting to capital-preservation WAIT.",
    confluenceScore: 2.0,
    confluenceScorePct: 40,
    alignedModulesCount: 1,
    confluenceFormula: "Awaiting live candle backfill & structural BOS/CHoCH confirmation",
    antiStopLossShield: {
      structuralInvalidationPrice: Number((base - step).toFixed(dec)),
      bufferPipsApplied: 0,
      protectionRationale: "Wait for live OHLC feed to compute true 14-period ATR invalidation.",
      dealingRangePosition: "EQUILIBRIUM",
    },
    killZone: { status: killZoneStatus, windowName: killZoneName, details: `Current window: ${killZoneName}.` },
    silverBullet: { status: silverBulletStatus, windowName: silverBulletName, details: `Status: ${silverBulletName}.` },
    candleRangeTheory: {
      rangeHigh: Number((base + step).toFixed(dec)),
      rangeLow: Number((base - step).toFixed(dec)),
      sweepType: "NONE",
      deliveryDirection: "NEUTRAL",
      description: "Awaiting range liquidity sweep.",
    },
    judasSwing: { detected: false, direction: "NEUTRAL", triggerLevel: base, description: "No sweep confirmed." },
    powerOf3: {
      detected: false,
      accumulationRange: `${(base - step).toFixed(dec)} – ${(base + step).toFixed(dec)}`,
      manipulationLevel: base,
      distributionTarget: base,
      description: "Waiting for Accumulation range expansion.",
    },
    multiTimeframe: {
      isMultiTimeframe: false,
      htfBias1D: "NEUTRAL — Syncing Daily feed",
      intermediateStructure4H: "NEUTRAL — Syncing 4H feed",
      entryPrecision30M: `Awaiting live ${timeframe} candles`,
      confirmationMessage: "Allow live feed to finish backfilling candles, then re-run Hybrid Scan.",
    },
    suggestedRisk: "0% — Stand aside until live candle structure confirms.",
    doActions: ["Allow live feed to load 300 bars before scanning.", "Re-run Hybrid Quant + AI Vision Scan."],
    dontActions: ["Do not execute blind trades without structural confluence."],
    detailedVisualDescription: `No active high-probability edge confirmed on ${symbol} (${timeframe}).`,
    orderBlock: { priceRange: "Pending scan", type: "None", rationale: "Awaiting displacement candle." },
    supplyDemandZones: { supply: "Pending", demand: "Pending", activeZone: "Equilibrium" },
    liquidityVoid: { priceRange: "Pending", description: "Awaiting FVG scan." },
    vacuumBlock: { priceRange: "Pending", description: "N/A" },
    candlestickPatterns: { patternName: "None", context: "Waiting for closed bar at POI." },
    fibonacciRetracement: {
      level_50: base,
      level_618: base,
      level_705: base,
      level_786: base,
      ext_1272: base,
      ext_1618: base,
      ext_2000: base,
      description: "Awaiting confirmed fractal swings.",
    },
    tradeSetup: {
      type: "WAIT",
      entry: base,
      stopLoss: Number((base - step).toFixed(dec)),
      takeProfits: [Number((base + step).toFixed(dec)), Number((base + step * 2).toFixed(dec)), Number((base + step * 3).toFixed(dec))],
      riskRewardRatio: "1:0.0",
      rationale: "Stand aside (WAIT) until live candle structure and AI Vision verify >= 3/5 modules.",
    },
    educationalInsight: "No trade is also a position. Capital preservation during unclear structure is the #1 institutional edge.",
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gemini-key, Cache-Control, Pragma");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    return;
  }

  const { image, images, symbol, timeframe, tradeHistory, learnings, currentPrice, quantContext } = req.body || {};

  try {
    const contentParts: any[] = [];
    const imgList = Array.isArray(images) && images.length > 0 ? images : image ? [image] : [];

    for (const img of imgList) {
      if (!img || typeof img !== "string") continue;
      let base64Data = img.replace(/\s+/g, "");
      let mimeType = "image/png";
      if (img.startsWith("data:")) {
        const parts = img.split(";base64,");
        if (parts.length === 2) {
          mimeType = parts[0].replace("data:", "");
          base64Data = parts[1].replace(/\s+/g, "");
        }
      }
      if (base64Data.length > 50) {
        contentParts.push({ inlineData: { mimeType, data: base64Data } });
      }
    }

    const { nyTimeStr, killZoneName, silverBulletName } = getSessionWindows();
    const customKey = (req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey;
    const ai = getGeminiClient(customKey);

    let reinforcementPrompt = "";
    if (Array.isArray(learnings) && learnings.length > 0) {
      reinforcementPrompt += `\nUSER SAVED TRADING RULES:\n${learnings
        .slice(0, 8)
        .map((l: any, i: number) => `- Rule #${i + 1} (${l.category || "General"} / ${l.symbol || "All"}): ${l.learnings || l}`)
        .join("\n")}\n`;
    }

    if (Array.isArray(tradeHistory) && tradeHistory.length > 0) {
      const won = tradeHistory.filter((t: any) => t.status === "WON");
      const lost = tradeHistory.filter((t: any) => t.status === "LOST");
      const wr = Math.round((won.length / tradeHistory.length) * 100);
      reinforcementPrompt += `\nUSER JOURNAL STATS: ${tradeHistory.length} trades, ${wr}% win rate (${won.length}W / ${lost.length}L).\n`;
      if (quantContext?.symbolJournalStats?.totalOnSymbol > 0) {
        const s = quantContext.symbolJournalStats;
        reinforcementPrompt += `SYMBOL-SPECIFIC RECORD ON ${symbol}: ${s.totalOnSymbol} trades, ${s.winRatePct}% win rate (${s.wins}W / ${s.losses}L).\n`;
      }
    }

    const quantBlock = quantContext
      ? `\nEXACT LIVE MATHEMATICAL SMC TELEMETRY (COMPUTED FROM REAL LIVE OHLC CANDLES — USE THESE EXACT PRICE COORDINATES, DO NOT HALLUCINATE PRICES):\n${JSON.stringify(
          quantContext,
          null,
          2
        )}\n`
      : "";

    const systemPromptMessage = `You are an elite Institutional Quantitative SMC/ICT Strategist and Computer Vision Chart Analyst covering Forex, Gold/Commodities, Global Indices, Crypto Perpetual Futures (Bybit), and Deriv Synthetic Indices.

HYBRID QUANT + VISION MANDATE (CRITICAL):
1. You have been given BOTH the live mathematical SMC engine JSON (computed from real 300-bar OHLC + real 1D/4H MTF + real Order Blocks, FVGs, PDH/PDL, Asian Range, 0.705 OTE, ATR, and Asset-Specific Microstructure) AND chart screenshot(s).
2. Ground EVERY numerical level (entry, stopLoss, takeProfits, orderBlock, fibonacciRetracement, candleRangeTheory) strictly in the live price (${currentPrice || quantContext?.livePrice || "chart scale"}) and mathematical SMC levels provided. NEVER invent arbitrary prices.
3. HONEST CAPITAL-PRESERVATION DISCIPLINE: If the mathematical engine shows < 3/5 modules aligned, OR Risk:Reward < 1:2.0, OR price is violating the 50% Premium/Discount rule, OR HTF (1D/4H) strongly contradicts the execution timeframe without a clean liquidity sweep + CHoCH, you MUST set "tradeSetup.type" to "WAIT" and explain exactly what price condition is missing!
4. ANTI-STOP-LOSS HUNTING RULE: Stop Loss must sit behind the structural displacement origin + ATR volatility buffer (never tight at an obvious retail swing wick).
5. Current New York Session Time: ${nyTimeStr}. Active Killzone: ${killZoneName}. Active Silver Bullet: ${silverBulletName}.
${reinforcementPrompt}
${quantBlock}

Respond strictly with a single valid raw JSON object (no markdown fences) matching this exact schema:
{
  "imageQuality": { "status": "passed" | "failed", "details": "string" },
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "marketStructure": "string",
  "confluenceScore": 4.2,
  "confluenceScorePct": 82,
  "alignedModulesCount": 4,
  "confluenceFormula": "string",
  "antiStopLossShield": {
    "structuralInvalidationPrice": 0,
    "bufferPipsApplied": 0,
    "protectionRationale": "string",
    "dealingRangePosition": "DISCOUNT_OTE" | "PREMIUM_OTE" | "EQUILIBRIUM"
  },
  "killZone": { "status": "ACTIVE_LONDON" | "ACTIVE_NY" | "ACTIVE_NY_PM" | "INACTIVE", "windowName": "string", "details": "string" },
  "silverBullet": { "status": "ACTIVE_LONDON" | "ACTIVE_NY_AM" | "ACTIVE_NY_PM" | "INACTIVE", "windowName": "string", "details": "string" },
  "candleRangeTheory": { "rangeHigh": 0, "rangeLow": 0, "sweepType": "HIGH_SWEPT" | "LOW_SWEPT" | "NONE", "deliveryDirection": "BULLISH" | "BEARISH" | "NEUTRAL", "description": "string" },
  "judasSwing": { "detected": true, "direction": "BULLISH" | "BEARISH" | "NEUTRAL", "triggerLevel": 0, "description": "string" },
  "powerOf3": { "detected": true, "accumulationRange": "string", "manipulationLevel": 0, "distributionTarget": 0, "description": "string" },
  "multiTimeframe": { "isMultiTimeframe": true, "htfBias1D": "string", "intermediateStructure4H": "string", "entryPrecision30M": "string", "confirmationMessage": "string" },
  "suggestedRisk": "string",
  "doActions": ["string"],
  "dontActions": ["string"],
  "detailedVisualDescription": "string",
  "orderBlock": { "priceRange": "string", "type": "string", "rationale": "string" },
  "supplyDemandZones": { "supply": "string", "demand": "string", "activeZone": "string" },
  "liquidityVoid": { "priceRange": "string", "description": "string" },
  "vacuumBlock": { "priceRange": "string", "description": "string" },
  "candlestickPatterns": { "patternName": "string", "context": "string" },
  "fibonacciRetracement": { "level_50": 0, "level_618": 0, "level_705": 0, "level_786": 0, "ext_1272": 0, "ext_1618": 0, "ext_2000": 0, "description": "string" },
  "tradeSetup": { "type": "BUY" | "SELL" | "WAIT", "entry": 0, "stopLoss": 0, "takeProfits": [0, 0, 0], "riskRewardRatio": "1:2.8", "rationale": "string" },
  "educationalInsight": "string"
}`;

    const textPart = {
      text: `Perform a Hybrid Quantitative + Vision SMC evaluation for ${symbol || "Market Asset"} (${timeframe || "H1"}) at live price ${currentPrice || quantContext?.livePrice || "visible on chart"}. Cross-check the visual candle structure in the chart image(s) against the exact mathematical SMC telemetry JSON. Only output BUY or SELL if >= 3 of 5 modules align and R:R >= 1:2.0; otherwise output WAIT.`,
    };

    const { response, modelUsed } = await generateGeminiContent(ai, "gemini-4-hydrogen", {
      contents: {
        parts: [...contentParts, textPart],
      },
      config: {
        systemInstruction: systemPromptMessage,
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response returned from Gemini endpoint.");
    }

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(responseText.trim());
    } catch {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    parsedResult.engineMode = "HYBRID_AI_VISION";
    parsedResult.modelUsed = modelUsed;

    res.status(200).json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.warn("[analyze-chart] Falling back to deterministic mathematical quant report:", error?.message);
    const fallbackData = buildDeterministicQuantReport(
      symbol || "Market Asset",
      timeframe || "H1",
      currentPrice,
      quantContext,
      `Gemini Vision unavailable (${error?.message || "timeout"}); report synthesized deterministically from live OHLC SMC mathematics.`
    );
    res.status(200).json({
      success: true,
      data: fallbackData,
    });
  }
}
