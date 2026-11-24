import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getAssetPlaybook } from "./_lib/playbooks.js";

type TradingStyle = "SCALP" | "NORMAL";

interface NewsRiskReport {
  level: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  events: string[];
  sources: { title: string; uri: string }[];
}

async function fetchLiveNewsRisk(
  ai: GoogleGenAI,
  symbol: string,
  playbook: ReturnType<typeof getAssetPlaybook>
): Promise<NewsRiskReport> {
  if (!playbook.needsNewsCheck) {
    return {
      level: "NONE",
      summary: "Synthetic Indices run 24/7 on an algorithmic volatility engine with zero fundamental news impact.",
      events: [],
      sources: [],
    };
  }

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5500));
    const promptText = `Today is ${todayStr}. Check if there are any high-impact economic calendar events (CPI, NFP, FOMC, Powell speech, GDP, ECB/BoE/BoJ rates) or breaking market catalysts affecting ${symbol} (${playbook.newsQueryHint}) today or within the next 24 hours. Reply in 2 concise plain-English sentences starting with RISK_LEVEL: LOW, MEDIUM, or HIGH.`;
    const searchPromise = (async () => {
      for (const modelName of ["gemini-4-hydrogen", "gemini-3.1-flash-lite"]) {
        try {
          return await ai.models.generateContent({
            model: modelName,
            contents: promptText,
            config: {
              tools: [{ googleSearch: {} }],
              ...(modelName.startsWith("gemini-4")
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });
        } catch {
          // Try next model
        }
      }
      return null;
    })();

    const response: any = await Promise.race([searchPromise, timeoutPromise]);
    if (!response || !response.text) {
      return {
        level: "LOW",
        summary: "No major breaking news alert returned; always check your broker calendar before entering around London/NY opens.",
        events: [],
        sources: [],
      };
    }

    const text = String(response.text).trim();
    const upper = text.toUpperCase();
    const level: NewsRiskReport["level"] = upper.includes("RISK_LEVEL: HIGH")
      ? "HIGH"
      : upper.includes("RISK_LEVEL: MEDIUM")
      ? "MEDIUM"
      : "LOW";

    const cleanedSummary = text
      .replace(/RISK_LEVEL:\s*(HIGH|MEDIUM|LOW)\s*[-:.]?\s*/i, "")
      .replace(/\s+/g, " ")
      .slice(0, 420);

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: { title: string; uri: string }[] = chunks
      .filter((c: any) => c?.web?.uri)
      .slice(0, 3)
      .map((c: any) => ({
        title: String(c.web.title || "Market News Source").slice(0, 80),
        uri: String(c.web.uri),
      }));

    return {
      level,
      summary: cleanedSummary,
      events: [],
      sources,
    };
  } catch {
    return {
      level: "LOW",
      summary: "Live economic calendar check skipped (timeout). Verify major USD/EUR/GBP releases before trading.",
      events: [],
      sources: [],
    };
  }
}

function runRiskCriticAudit(
  result: any,
  tradingStyle: TradingStyle,
  quantContext: any,
  newsRisk: NewsRiskReport
) {
  const warnings: string[] = [];
  const ts = result?.tradeSetup || {};
  const entry = Number(ts.entry) || 0;
  const sl = Number(ts.stopLoss) || 0;
  const tp1 = Array.isArray(ts.takeProfits) ? Number(ts.takeProfits[0]) || 0 : 0;
  const tp2 = Array.isArray(ts.takeProfits) ? Number(ts.takeProfits[1]) || 0 : 0;
  const livePrice = Number(quantContext?.livePrice) || 0;
  const atr = Number(quantContext?.atr || quantContext?.structure?.atr) || 0;
  const isScalp = tradingStyle === "SCALP";

  let criticalFlaws = 0;

  if (ts.type === "BUY" || ts.type === "SELL") {
    const riskDist = Math.abs(entry - sl);
    const reward1 = Math.abs(tp1 - entry);
    const reward2 = Math.abs(tp2 - entry);

    // 1. Stop Loss direction sanity
    if ((ts.type === "BUY" && sl >= entry) || (ts.type === "SELL" && sl <= entry)) {
      warnings.push("Stop Loss was placed on the wrong side of Entry — verify SL before placing order.");
      criticalFlaws++;
    }

    // 2. Stop Loss too tight vs ATR
    if (atr > 0 && riskDist > 0 && riskDist < atr * 0.45) {
      warnings.push("Stop Loss is tighter than 0.45× ATR — high chance of getting wicked out by normal noise.");
      criticalFlaws++;
    }

    // 3. Chasing check
    if (atr > 0 && livePrice > 0 && Math.abs(entry - livePrice) > atr * (isScalp ? 1.8 : 3.2)) {
      warnings.push("Entry sits relatively far from live spot price — use a Limit Order instead of chasing with a Market Order.");
    }

    // 4. Risk-to-Reward check
    const rrCheck = riskDist > 0 ? Math.max(reward1, reward2) / riskDist : 0;
    const minRR = isScalp ? 1.15 : 1.5;
    if (riskDist > 0 && rrCheck < minRR) {
      warnings.push(`Reward-to-Risk (${rrCheck.toFixed(2)}R) is below recommended minimum (${minRR}R) for a ${isScalp ? "Scalp" : "Normal"} trade.`);
      criticalFlaws++;
    }

    // 5. Counter-HTF check on Normal trades
    const d1 = String(quantContext?.mtf?.d1Bias || "").toUpperCase();
    const h4 = String(quantContext?.mtf?.h4Bias || "").toUpperCase();
    const fightingBothHtf =
      (ts.type === "BUY" && d1 === "BEARISH" && h4 === "BEARISH") ||
      (ts.type === "SELL" && d1 === "BULLISH" && h4 === "BULLISH");
    if (!isScalp && fightingBothHtf) {
      warnings.push("Caution: This Normal Trade goes against both the Daily (1D) and 4-Hour (4H) trends — cut size or wait for alignment.");
    }

    // 6. High-impact news trap on Scalps
    if (newsRisk.level === "HIGH") {
      warnings.push(
        isScalp
          ? "High-impact news risk detected today — spreads can spike sharply on tight scalps. Cut risk by 50% or wait until after the release."
          : "High-impact economic event active today — expect extra volatility around the release window."
      );
    }

    // 7. Choppy regime warning
    if (quantContext?.marketRegime?.regime === "CHOPPY_HIGH_VOL") {
      warnings.push("Market regime is currently choppy with high volatility — wait for a clean candle close at your zone.");
    }
  }

  let verdictAdjusted = false;
  if (criticalFlaws >= 2 && (ts.type === "BUY" || ts.type === "SELL")) {
    result.tradeSetup.type = "WAIT";
    result.tradeSetup.rationale = `Downgraded to WAIT by Risk Critic: ${warnings.join(" ")}`;
    verdictAdjusted = true;
  }

  return {
    passed: warnings.length === 0,
    severity: criticalFlaws > 0 || newsRisk.level === "HIGH" ? "HIGH" : warnings.length > 0 ? "MEDIUM" : "LOW",
    verdictAdjusted,
    warnings,
    summary:
      warnings.length === 0
        ? "Passed all 7 Risk Critic safety checks (SL placement, ATR cushion, R:R ratio, trend & news risk)."
        : verdictAdjusted
        ? "Risk Critic downgraded this setup to WAIT due to multiple risk traps."
        : `Risk Critic flagged ${warnings.length} item${warnings.length === 1 ? "" : "s"} to watch before entering.`,
  };
}

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
  let killZoneName = "Quiet / Off-Peak Session";
  if (nyDecimal >= 2.0 && nyDecimal <= 5.0) {
    killZoneStatus = "ACTIVE_LONDON";
    killZoneName = "London Open Session (02:00–05:00 EST)";
  } else if (nyDecimal >= 7.0 && nyDecimal <= 10.5) {
    killZoneStatus = "ACTIVE_NY";
    killZoneName = "New York Morning Session (07:00–10:30 EST)";
  } else if (nyDecimal >= 14.0 && nyDecimal <= 16.0) {
    killZoneStatus = "ACTIVE_NY_PM";
    killZoneName = "New York Afternoon Session (14:00–16:00 EST)";
  }

  let silverBulletStatus: "ACTIVE_LONDON" | "ACTIVE_NY_AM" | "ACTIVE_NY_PM" | "INACTIVE" = "INACTIVE";
  let silverBulletName = "Normal Liquidity Window";
  if (nyHour === 3) {
    silverBulletStatus = "ACTIVE_LONDON";
    silverBulletName = "High-Volume London Hour (03:00–04:00 EST)";
  } else if (nyHour === 10) {
    silverBulletStatus = "ACTIVE_NY_AM";
    silverBulletName = "High-Volume NY Hour (10:00–11:00 EST)";
  } else if (nyHour === 14) {
    silverBulletStatus = "ACTIVE_NY_PM";
    silverBulletName = "NY Afternoon Push (14:00–15:00 EST)";
  }

  return { nyTimeStr, killZoneStatus, killZoneName, silverBulletStatus, silverBulletName };
}

function buildDeterministicQuantReport(
  symbol: string,
  timeframe: string,
  tradingStyle: TradingStyle,
  currentPrice?: number,
  quantContext?: any,
  reasonNote?: string
) {
  const { killZoneStatus, killZoneName, silverBulletStatus, silverBulletName } = getSessionWindows();
  const isScalp = tradingStyle === "SCALP";
  const styleTitle = isScalp ? "Scalp Setup" : "Normal Trade Setup";
  const holdTime = isScalp ? "5 – 45 mins" : "2 – 24 hours";

  if (quantContext && quantContext.executionCard && quantContext.fibonacci) {
    const q = quantContext;
    const plans = q.tradePlans || {};
    const activePlan = isScalp ? plans.scalp || q.executionCard : plans.normal || q.executionCard;
    const exec = q.executionCard;
    const fib = q.fibonacci;
    const struct = q.structure || {};
    const mtf = q.mtf || {};
    const primaryOb =
      Array.isArray(q.orderBlocks) && q.orderBlocks.length > 0
        ? q.orderBlocks[q.orderBlocks.length - 1]
        : null;
    const primaryFvg =
      Array.isArray(q.fairValueGaps) && q.fairValueGaps.length > 0
        ? q.fairValueGaps[q.fairValueGaps.length - 1]
        : null;

    const isBull = q.directionalBias === "BULLISH";
    const isBear = q.directionalBias === "BEARISH";
    const bias: "BULLISH" | "BEARISH" | "NEUTRAL" = isBull ? "BULLISH" : isBear ? "BEARISH" : "NEUTRAL";
    const rawOrderType = String(activePlan.orderType || exec.orderType || "WAIT");
    const setupType: "BUY" | "SELL" | "WAIT" = rawOrderType.includes("BUY")
      ? "BUY"
      : rawOrderType.includes("SELL")
      ? "SELL"
      : "WAIT";

    const roundVal = (n: number) => {
      const ref = Number(q.livePrice || currentPrice || 1);
      return Number(Number(n || 0).toFixed(ref < 5 ? 5 : ref < 50 ? 3 : 2));
    };

    const entry = roundVal(activePlan.entry ?? exec.optimalEntry705);
    const stopLoss = roundVal(activePlan.stopLoss ?? exec.invalidationSL);
    const tp1 = roundVal(activePlan.tp1 ?? exec.tp1_1272);
    const tp2 = roundVal(activePlan.tp2 ?? exec.tp2_1618);
    const tp3 = roundVal(activePlan.tp3 ?? exec.tp3_2000);
    const rrStr = activePlan.riskRewardRatio || exec.riskRewardRatio || (isScalp ? "1:1.8" : "1:2.5");

    const formatPlan = (p: any, fallbackStyle: TradingStyle) =>
      p
        ? {
            style: fallbackStyle,
            label: p.label || (fallbackStyle === "SCALP" ? "Scalp Setup (Quick In & Out)" : "Normal Trade (Day / Swing)"),
            holdTime: p.holdTime || (fallbackStyle === "SCALP" ? "5 – 45 mins" : "2 – 24 hours"),
            type: String(p.orderType || "").includes("BUY")
              ? "BUY"
              : String(p.orderType || "").includes("SELL")
              ? "SELL"
              : "WAIT",
            entry: roundVal(p.entry),
            stopLoss: roundVal(p.stopLoss),
            tp1: roundVal(p.tp1),
            tp2: roundVal(p.tp2),
            tp3: roundVal(p.tp3),
            riskRewardRatio: p.riskRewardRatio || "1:1.8",
          }
        : undefined;

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
      modelUsed: "Live Price-Action Math Engine",
      engineNotice: reasonNote || "Generated directly from live OHLC candle data.",
      tradingStyle,
      styleLabel: styleTitle,
      estimatedHoldTime: holdTime,
      imageQuality: {
        status: "passed",
        details: `Computed directly from live ${symbol} (${timeframe}) candles and higher-timeframe trend check.`,
      },
      bias,
      marketStructure: `${struct.ltfStructure || "Range structure"} · Higher TF: ${struct.htfStructure || "Syncing"}`,
      confluenceScore: Number(((q.confluenceScorePct || 55) / 20).toFixed(1)),
      confluenceScorePct: q.confluenceScorePct || 55,
      alignedModulesCount: q.alignedModulesCount || 0,
      confluenceFormula: q.confluenceFormula || `${styleTitle} Live Technical Evaluation`,
      scalpPlan: formatPlan(plans.scalp, "SCALP"),
      normalPlan: formatPlan(plans.normal, "NORMAL"),
      antiStopLossShield: {
        structuralInvalidationPrice: stopLoss,
        bufferPipsApplied: Number(Math.abs(entry - stopLoss).toFixed(entry < 5 ? 4 : 2)),
        protectionRationale: isScalp
          ? `Tight scalp Stop Loss (${activePlan.stopNote || "1× ATR"}) placed just outside recent short-term swing noise so small wicks don't knock you out.`
          : `Comfortable Stop Loss (${activePlan.stopNote || "1.5× ATR"}) placed safely behind the nearest swing support/resistance.`,
        dealingRangePosition: dealingPos,
      },
      killZone: {
        status: killZoneStatus,
        windowName: killZoneName,
        details:
          killZoneStatus === "INACTIVE"
            ? "Quieter market hours right now — keep targets realistic or wait for London/New York open for faster movement."
            : `Active ${killZoneName} — good movement and tighter spreads for ${isScalp ? "quick scalps" : "day/swing entries"}.`,
      },
      silverBullet: {
        status: silverBulletStatus,
        windowName: silverBulletName,
        details:
          silverBulletStatus === "INACTIVE"
            ? "Steady normal volume window."
            : `Peak hourly volatility (${silverBulletName}) — watch for quick momentum follow-through.`,
      },
      candleRangeTheory: {
        rangeHigh: roundVal(fib.swingHigh),
        rangeLow: roundVal(fib.swingLow),
        sweepType,
        deliveryDirection: bias,
        description: struct.sweepDescription || "Watching recent high/low range for a clean breakout or fakeout rejection.",
      },
      judasSwing: {
        detected: Boolean(struct.liquiditySweepDetected),
        direction: bias,
        triggerLevel: roundVal(isBull ? struct.sslPool || fib.swingLow : struct.bslPool || fib.swingHigh),
        description: struct.liquiditySweepDetected
          ? `Quick fakeout wick beyond ${roundVal(isBull ? struct.sslPool : struct.bslPool)} followed by rejection back into range.`
          : "No recent fakeout wick detected on the latest candles.",
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
            ? "Asian session range mapped; watch for a break above/below it to confirm today's direction."
            : "Current price range mapped for breakout and pullback targets.",
      },
      multiTimeframe: {
        isMultiTimeframe: true,
        htfBias1D: `${mtf.d1Bias || "RANGING"} — ${mtf.d1Event || "Checking Daily trend"}`,
        intermediateStructure4H: `${mtf.h4Bias || "RANGING"} — ${mtf.h4Event || "Checking 4H trend"}`,
        entryPrecision30M: `${struct.ltfStructure || timeframe} · Entry near ${entry}`,
        confirmationMessage: mtf.note || "Higher timeframe trend checked against your chart timeframe.",
      },
      suggestedRisk:
        setupType === "WAIT"
          ? "0% — Wait for a cleaner setup before entering."
          : isScalp
          ? "0.5%–1% risk per scalp. Take 50% profit at TP1, move Stop Loss to breakeven, and let the rest run to TP2."
          : "1% max risk per trade. Secure partial profit at TP1, move Stop Loss to breakeven, and hold for TP2.",
      doActions:
        setupType === "WAIT"
          ? [
              `Wait for price to pull back closer to ${entry} before entering.`,
              "Look for a clean green/red candle close confirming direction.",
              "Switch between Scalp and Normal mode if you want faster or wider targets.",
            ]
          : isScalp
          ? [
              `Enter ${setupType} near ${entry} with a tight Stop Loss at ${stopLoss}.`,
              `Lock in 50% profit quickly at TP1 (${tp1}) and move SL to entry.`,
              `Aim for TP2 (${tp2}) within ${holdTime} — don't overhold a scalp.`,
            ]
          : [
              `Place ${setupType} near ${entry} inside the key entry zone.`,
              `Set Stop Loss at ${stopLoss} to protect your account.`,
              `Take partial profits at TP1 (${tp1}) and let the main trade run to TP2 (${tp2}).`,
            ],
      dontActions: isScalp
        ? [
            "Do NOT widen your Stop Loss if a scalp goes against you — cut it fast.",
            "Do NOT over-leverage on M1/M5 noise; stick to 0.5%–1% risk.",
            "Do NOT turn a losing scalp into a long-term hold.",
          ]
        : [
            "Do NOT chase a big spike candle after price has already moved far away.",
            "Do NOT move your Stop Loss further away if price approaches invalidation.",
            "Do NOT risk more than 1%–2% of your account on a single setup.",
          ],
      detailedVisualDescription: `${styleTitle} scan on ${symbol} (${timeframe}) at live price ${roundVal(q.livePrice || currentPrice)}. ${q.alignedModulesCount}/5 checks passed (${q.confluenceScorePct}% score) with ${rrStr} Risk-to-Reward.`,
      orderBlock: {
        priceRange: primaryOb
          ? `${roundVal(primaryOb.bottom)} – ${roundVal(primaryOb.top)}`
          : `${roundVal(activePlan.entryZoneLow ?? exec.entryZoneLow)} – ${roundVal(activePlan.entryZoneHigh ?? exec.entryZoneHigh)}`,
        type: primaryOb ? (primaryOb.type.includes("BULL") ? "Key Support / Buy Zone" : "Key Resistance / Sell Zone") : "Key Entry Zone",
        rationale: primaryOb
          ? `Strong recent price reaction zone (${primaryOb.displacementAtrMultiple}x ATR move).`
          : "Based on the nearest support/resistance pullback zone.",
      },
      supplyDemandZones: {
        supply: `${roundVal(fib.equilibrium50)} – ${roundVal(fib.swingHigh)}`,
        demand: `${roundVal(fib.swingLow)} – ${roundVal(fib.equilibrium50)}`,
        activeZone: `${fib.currentZone === "DISCOUNT" ? "Lower / Buy Value Area" : fib.currentZone === "PREMIUM" ? "Upper / Sell Value Area" : "Middle Range"}`,
      },
      liquidityVoid: {
        priceRange: primaryFvg
          ? `${roundVal(primaryFvg.bottom)} – ${roundVal(primaryFvg.top)}`
          : "No major open price gap",
        description: primaryFvg
          ? `Open ${primaryFvg.type.toLowerCase()} price gap (midpoint ${roundVal(primaryFvg.midpointCE)}) that price often revisits.`
          : "Price action is balanced with no wide unfilled gap nearby.",
      },
      vacuumBlock: {
        priceRange: `${roundVal(Math.min(entry, stopLoss))} – ${roundVal(Math.max(entry, stopLoss))}`,
        description: "Stop-loss protection zone.",
      },
      candlestickPatterns: {
        patternName: q.candlestickTrigger?.patternName || "Monitoring live candle close",
        context: q.candlestickTrigger?.details || "Checking recent candles for momentum confirmation.",
      },
      fibonacciRetracement: {
        level_50: roundVal(fib.equilibrium50),
        level_618: roundVal(fib.ote618),
        level_705: roundVal(fib.ote705SweetSpot),
        level_786: roundVal(fib.ote786),
        ext_1272: tp1,
        ext_1618: tp2,
        ext_2000: tp3,
        description: fib.filterExplanation || "Pullback retracement levels from recent swing high and low.",
      },
      tradeSetup: {
        type: setupType,
        tradingStyle,
        holdTime,
        entry,
        stopLoss,
        takeProfits: [tp1, tp2, tp3],
        riskRewardRatio: rrStr,
        rationale:
          setupType === "WAIT"
            ? `Waiting for a cleaner ${isScalp ? "scalp" : "day/swing"} trigger (${q.alignedModulesCount}/5 checks passed). Watch ${entry} for confirmation.`
            : `${styleTitle} (${setupType}) near ${entry} targeting TP1 ${tp1} and TP2 ${tp2} (${rrStr} R:R, est. hold ${holdTime}).`,
      },
      educationalInsight: isScalp
        ? "Scalping is about fast, disciplined base hits: take clean 1:1.2 to 1:1.8 moves, respect your tight stop loss, and never let a quick scalp turn into an unplanned hold."
        : "Consistent day and swing trading comes from waiting for price to reach a clear support/resistance zone, keeping your stop loss safe, and taking steady 1:2+ winners.",
    };
  }

  const base = currentPrice && currentPrice > 0 ? currentPrice : 1.085;
  const dec = base < 5 ? 4 : 2;
  const step = base * (isScalp ? 0.0025 : 0.005);
  return {
    engineMode: "DETERMINISTIC_QUANT_ENGINE",
    modelUsed: "Live Price-Action Math Engine",
    engineNotice: reasonNote || "Waiting for live candles to finish loading.",
    tradingStyle,
    styleLabel: styleTitle,
    estimatedHoldTime: holdTime,
    imageQuality: { status: "passed", details: "Chart received; candle history still loading." },
    bias: "NEUTRAL",
    marketStructure: "Waiting for live candle data before giving a trade call.",
    confluenceScore: 2.0,
    confluenceScorePct: 40,
    alignedModulesCount: 1,
    confluenceFormula: "Waiting for live candle confirmation",
    antiStopLossShield: {
      structuralInvalidationPrice: Number((base - step).toFixed(dec)),
      bufferPipsApplied: 0,
      protectionRationale: "Wait a moment for live candles to load accurate stop-loss spacing.",
      dealingRangePosition: "EQUILIBRIUM",
    },
    killZone: { status: killZoneStatus, windowName: killZoneName, details: `Current session: ${killZoneName}.` },
    silverBullet: { status: silverBulletStatus, windowName: silverBulletName, details: `Status: ${silverBulletName}.` },
    candleRangeTheory: {
      rangeHigh: Number((base + step).toFixed(dec)),
      rangeLow: Number((base - step).toFixed(dec)),
      sweepType: "NONE",
      deliveryDirection: "NEUTRAL",
      description: "Waiting for live price range.",
    },
    judasSwing: { detected: false, direction: "NEUTRAL", triggerLevel: base, description: "No fakeout detected." },
    powerOf3: {
      detected: false,
      accumulationRange: `${(base - step).toFixed(dec)} – ${(base + step).toFixed(dec)}`,
      manipulationLevel: base,
      distributionTarget: base,
      description: "Waiting for range breakout.",
    },
    multiTimeframe: {
      isMultiTimeframe: false,
      htfBias1D: "NEUTRAL — Loading Daily candles",
      intermediateStructure4H: "NEUTRAL — Loading 4H candles",
      entryPrecision30M: `Loading ${timeframe} candles`,
      confirmationMessage: "Let the live chart load for a couple seconds, then click Analyze again.",
    },
    suggestedRisk: "0% — Stand aside until candles finish loading.",
    doActions: ["Wait a moment for live candles to load.", "Click Analyze again to get your setup."],
    dontActions: ["Do not enter blindly without a clear Stop Loss."],
    detailedVisualDescription: `Waiting for live data on ${symbol} (${timeframe}).`,
    orderBlock: { priceRange: "Loading...", type: "Key Zone", rationale: "Loading live candles." },
    supplyDemandZones: { supply: "Loading...", demand: "Loading...", activeZone: "Middle Range" },
    liquidityVoid: { priceRange: "None", description: "Loading live candles." },
    vacuumBlock: { priceRange: "Pending", description: "N/A" },
    candlestickPatterns: { patternName: "Loading...", context: "Waiting for latest candle close." },
    fibonacciRetracement: {
      level_50: base,
      level_618: base,
      level_705: base,
      level_786: base,
      ext_1272: base,
      ext_1618: base,
      ext_2000: base,
      description: "Loading swing levels.",
    },
    tradeSetup: {
      type: "WAIT",
      tradingStyle,
      holdTime,
      entry: base,
      stopLoss: Number((base - step).toFixed(dec)),
      takeProfits: [
        Number((base + step).toFixed(dec)),
        Number((base + step * 2).toFixed(dec)),
        Number((base + step * 3).toFixed(dec)),
      ],
      riskRewardRatio: "1:0.0",
      rationale: "Wait a moment for live market candles to sync, then re-run Analyze.",
    },
    educationalInsight: "Good trading starts with patience — only take trades with a clear entry, stop loss, and target.",
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

  const { image, images, symbol, timeframe, tradeHistory, learnings, currentPrice, quantContext, tradingStyle: reqStyle } =
    req.body || {};

  const tfUpper = String(timeframe || "H1").toUpperCase();
  const tradingStyle: TradingStyle =
    reqStyle === "SCALP" || reqStyle === "NORMAL"
      ? reqStyle
      : quantContext?.tradingStyle === "SCALP" || quantContext?.tradingStyle === "NORMAL"
      ? quantContext.tradingStyle
      : tfUpper === "M1" || tfUpper === "M5"
      ? "SCALP"
      : "NORMAL";

  const isScalp = tradingStyle === "SCALP";

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

    const playbook = getAssetPlaybook(symbol || quantContext?.symbol || "", quantContext?.marketType);
    const newsRisk = await fetchLiveNewsRisk(ai, symbol || quantContext?.symbol || "Market", playbook);

    let reinforcementPrompt = "";
    if (Array.isArray(learnings) && learnings.length > 0) {
      reinforcementPrompt += `\nTRADER'S PERSONAL RULES (MUST RESPECT & MENTION WHEN RELEVANT):\n${learnings
        .slice(0, 10)
        .map((l: any, i: number) => `- Rule #${i + 1} (${l.category || "General"} / ${l.symbol || "All"}): ${l.learnings || l}`)
        .join("\n")}\n`;
    }

    if (Array.isArray(tradeHistory) && tradeHistory.length > 0) {
      const won = tradeHistory.filter((t: any) => t.status === "WON");
      const lost = tradeHistory.filter((t: any) => t.status === "LOST");
      const wr = Math.round((won.length / Math.max(1, won.length + lost.length)) * 100);
      reinforcementPrompt += `\nCLOSED-LOOP JOURNAL RECORD: ${tradeHistory.length} trades, ${wr}% win rate (${won.length}W / ${lost.length}L).\n`;
      if (quantContext?.symbolJournalStats?.totalOnSymbol > 0) {
        const s = quantContext.symbolJournalStats;
        reinforcementPrompt += `RECORD ON ${symbol}: ${s.totalOnSymbol} trades, ${s.winRatePct}% win rate (${s.wins}W / ${s.losses}L). Scalp WR: ${s.scalpWinRatePct ?? "N/A"}%, Normal WR: ${s.normalWinRatePct ?? "N/A"}%.\n`;
        if (Array.isArray(s.recentLossNotes) && s.recentLossNotes.length > 0) {
          reinforcementPrompt += `RECENT LOSSES TO AVOID REPEATING ON ${symbol}:\n${s.recentLossNotes
            .map((n: string) => `- ${n}`)
            .join("\n")}\n`;
        }
      }
    }

    const playbookBlock = `\nASSET PLAYBOOK (${playbook.title}):\n${playbook.rules
      .map((r, i) => `${i + 1}. ${r}`)
      .join("\n")}\n\nLIVE ECONOMIC / NEWS RISK (${newsRisk.level}): ${newsRisk.summary}\n`;

    const quantBlock = quantContext
      ? `\nLIVE MARKET PRICE, REGIME INDICATORS & TECHNICAL DATA (COMPUTED FROM REAL LIVE CANDLES — GROUND ALL PRICE NUMBERS IN THIS DATA):\n${JSON.stringify(
          quantContext,
          null,
          2
        )}\n`
      : "";

    const styleRules = isScalp
      ? `ACTIVE MODE: SCALP SETUP (Quick In-and-Out Trade, 5–45 mins hold time)
- Give a practical, actionable SCALP trade plan anchored close to the current live price (${currentPrice || quantContext?.livePrice || "chart price"}).
- Use a TIGHT, realistic scalp Stop Loss (~1× ATR, just behind the nearest short-term swing high/low) — NEVER give a giant multi-day swing stop loss!
- Use fast, achievable Take Profits: TP1 around 1:1.2 R:R (take 50% off & move SL to breakeven), TP2 around 1:1.8 R:R, TP3 around 1:2.5 R:R.
- Output BUY or SELL whenever momentum, trend, or a pullback zone shows a realistic scalp edge (>= 2/5 checks and >= 1:1.5 R:R). Only output WAIT if the chart is completely flat/choppy or strongly contradicting.`
      : `ACTIVE MODE: NORMAL TRADE SETUP (Everyday Day Trade / Swing Trade, 2–24 hours hold time)
- Give a clean, practical NORMAL retail day/swing trade setup based on trend direction, support/resistance, and a clean pullback.
- Use a comfortable Stop Loss (~1.4×–1.8× ATR, safely beyond the recent swing high/low).
- Use realistic targets: TP1 around 1:1.5 R:R (take partial & move SL to breakeven), TP2 around 1:2.5 R:R (main target), TP3 around 1:3.5 R:R.
- Output BUY or SELL when >= 3/5 technical checks align with >= 1:1.8 R:R; otherwise output WAIT and clearly state the exact price to watch for entry.`;

    const systemPromptMessage = `You are a practical, plain-spoken Retail Trading Coach & Technical Chart Analyst helping an everyday independent trader trade Forex, Gold, Indices, Crypto, and Deriv Synthetic Indices.

CRITICAL TONE & STYLE RULES (READ CAREFULLY):
1. The user is an EVERYDAY TRADER — NOT an institutional bank desk! NEVER call the setup an "Institutional Setup", "Institutional Verdict", or flood the report with heavy jargon like "interbank delivery", "PD arrays", "Judas Swing", "Power of 3 AMD", or "Smart Money orderflow".
2. Write in simple, crystal-clear, practical trading English: talk about Trend, Support & Resistance, Pullback Entry, Stop Loss, Take Profit, Candlestick Signals, Fakeouts, Market Regime (Trending/Ranging/Squeeze), News Risk, and Risk-to-Reward.
3. ${styleRules}
4. ALWAYS populate BOTH "scalpPlan" AND "normalPlan" with exact numbers grounded in the live price (${currentPrice || quantContext?.livePrice || "chart scale"}) and the provided live market data, while "tradeSetup" matches the user's selected mode (${tradingStyle}). NEVER invent random prices far from the live price.
5. Current New York Time: ${nyTimeStr}. Session: ${killZoneName}.
${playbookBlock}
${reinforcementPrompt}
${quantBlock}

Respond strictly with a single valid raw JSON object (no markdown fences) matching this exact schema:
{
  "tradingStyle": "${tradingStyle}",
  "styleLabel": "${isScalp ? "Scalp Setup" : "Normal Trade Setup"}",
  "estimatedHoldTime": "${isScalp ? "5 – 45 mins" : "2 – 24 hours"}",
  "imageQuality": { "status": "passed" | "failed", "details": "string" },
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "marketStructure": "plain-English summary of trend and structure",
  "confluenceScore": 4.0,
  "confluenceScorePct": 78,
  "alignedModulesCount": 4,
  "confluenceFormula": "short plain-English summary of why the setup scores this way",
  "scalpPlan": {
    "style": "SCALP",
    "label": "Scalp Setup (Quick In & Out)",
    "holdTime": "5 – 45 mins",
    "type": "BUY" | "SELL" | "WAIT",
    "entry": 0,
    "stopLoss": 0,
    "tp1": 0,
    "tp2": 0,
    "tp3": 0,
    "riskRewardRatio": "1:1.8"
  },
  "normalPlan": {
    "style": "NORMAL",
    "label": "Normal Trade (Day / Swing)",
    "holdTime": "2 – 24 hours",
    "type": "BUY" | "SELL" | "WAIT",
    "entry": 0,
    "stopLoss": 0,
    "tp1": 0,
    "tp2": 0,
    "tp3": 0,
    "riskRewardRatio": "1:2.5"
  },
  "antiStopLossShield": {
    "structuralInvalidationPrice": 0,
    "bufferPipsApplied": 0,
    "protectionRationale": "plain-English explanation of why this Stop Loss is safe from normal wicks",
    "dealingRangePosition": "DISCOUNT_OTE" | "PREMIUM_OTE" | "EQUILIBRIUM"
  },
  "killZone": { "status": "ACTIVE_LONDON" | "ACTIVE_NY" | "ACTIVE_NY_PM" | "INACTIVE", "windowName": "string", "details": "plain-English session volatility note" },
  "silverBullet": { "status": "ACTIVE_LONDON" | "ACTIVE_NY_AM" | "ACTIVE_NY_PM" | "INACTIVE", "windowName": "string", "details": "string" },
  "candleRangeTheory": { "rangeHigh": 0, "rangeLow": 0, "sweepType": "HIGH_SWEPT" | "LOW_SWEPT" | "NONE", "deliveryDirection": "BULLISH" | "BEARISH" | "NEUTRAL", "description": "plain-English range breakout/fakeout summary" },
  "judasSwing": { "detected": false, "direction": "BULLISH" | "BEARISH" | "NEUTRAL", "triggerLevel": 0, "description": "plain-English note on whether a fakeout wick just happened" },
  "powerOf3": { "detected": false, "accumulationRange": "string", "manipulationLevel": 0, "distributionTarget": 0, "description": "plain-English summary of today's range and target" },
  "multiTimeframe": { "isMultiTimeframe": true, "htfBias1D": "plain Daily trend", "intermediateStructure4H": "plain 4H trend", "entryPrecision30M": "plain execution chart entry note", "confirmationMessage": "string" },
  "suggestedRisk": "simple risk tip e.g. Risk 0.5% to 1%, take partial at TP1 and move SL to breakeven",
  "doActions": ["clear actionable step 1", "step 2", "step 3"],
  "dontActions": ["clear mistake to avoid 1", "avoid 2", "avoid 3"],
  "detailedVisualDescription": "plain-English breakdown of what the chart is doing right now",
  "orderBlock": { "priceRange": "string", "type": "Key Support Zone or Key Resistance Zone", "rationale": "plain-English explanation" },
  "supplyDemandZones": { "supply": "string", "demand": "string", "activeZone": "string" },
  "liquidityVoid": { "priceRange": "string", "description": "plain-English price gap note" },
  "vacuumBlock": { "priceRange": "string", "description": "string" },
  "candlestickPatterns": { "patternName": "string", "context": "plain-English candle signal" },
  "fibonacciRetracement": { "level_50": 0, "level_618": 0, "level_705": 0, "level_786": 0, "ext_1272": 0, "ext_1618": 0, "ext_2000": 0, "description": "string" },
  "tradeSetup": { "type": "BUY" | "SELL" | "WAIT", "tradingStyle": "${tradingStyle}", "holdTime": "${isScalp ? "5 – 45 mins" : "2 – 24 hours"}", "entry": 0, "stopLoss": 0, "takeProfits": [0, 0, 0], "riskRewardRatio": "1:2.0", "rationale": "plain-English trade plan" },
  "educationalInsight": "short practical trader tip"
}`;

    const textPart = {
      text: `Analyze ${symbol || "Market Asset"} on the ${timeframe || "H1"} timeframe at live price ${currentPrice || quantContext?.livePrice || "visible on chart"} and give a practical ${isScalp ? "SCALP SETUP (quick trade, tight SL, fast TPs)" : "NORMAL TRADE SETUP (day/swing trade, clean S/R pullback, realistic TPs)"} for an everyday retail trader. Also populate both scalpPlan and normalPlan using the live market data. Keep all language simple, clear, and actionable.`,
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
    parsedResult.tradingStyle = tradingStyle;
    parsedResult.styleLabel = parsedResult.styleLabel || (isScalp ? "Scalp Setup" : "Normal Trade Setup");
    parsedResult.estimatedHoldTime = parsedResult.estimatedHoldTime || (isScalp ? "5 – 45 mins" : "2 – 24 hours");
    parsedResult.playbookTitle = playbook.title;
    parsedResult.newsRisk = newsRisk;
    parsedResult.marketRegime = quantContext?.marketRegime || null;
    parsedResult.riskCritic = runRiskCriticAudit(parsedResult, tradingStyle, quantContext, newsRisk);

    res.status(200).json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.warn("[analyze-chart] Falling back to live price-action calculation:", error?.message);
    const fallbackData = buildDeterministicQuantReport(
      symbol || "Market Asset",
      timeframe || "H1",
      tradingStyle,
      currentPrice,
      quantContext,
      `Live AI Vision temporarily unavailable (${error?.message || "timeout"}); generated directly from live market candles.`
    );
    res.status(200).json({
      success: true,
      data: fallbackData,
    });
  }
}
