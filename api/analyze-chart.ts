import { GoogleGenAI } from "@google/genai";

function getGeminiClient(customKey?: string): GoogleGenAI {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured. In Vercel: go to your Project Settings > Environment Variables, add GEMINI_API_KEY, and redeploy. You can also paste your Gemini API Key in the Control tab on your device."
    );
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
): Promise<any> {
  const modelsToTry = [primaryModel];
  if (primaryModel === "gemini-3.8-flash") {
    modelsToTry.push("gemini-3.6-flash", "gemini-3.1-flash-lite");
  } else {
    modelsToTry.push("gemini-3.8-flash", "gemini-3.6-flash");
  }

  const uniqueModels = Array.from(new Set(modelsToTry));
  const delayHelper = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastError: any = null;

  for (const modelName of uniqueModels) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const requestParams = {
          ...params,
          model: modelName,
        };
        const response = await ai.models.generateContent(requestParams);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err.message || err.status || "").toLowerCase();
        const responseBody = err.response ? String(JSON.stringify(err.response)) : "";
        const combinedErrorString = `${errMsg} ${responseBody}`.toLowerCase();

        const isFatal =
          combinedErrorString.includes("api_key_invalid") ||
          combinedErrorString.includes("api key not valid") ||
          combinedErrorString.includes("invalid key") ||
          combinedErrorString.includes("unauthorized") ||
          combinedErrorString.includes("bad credentials") ||
          err.status === 400 || err.status === 401 || err.status === 403;

        if (!isFatal && attempt < 3) {
          await delayHelper(attempt * 1000);
        } else {
          break;
        }
      }
    }
  }

  throw lastError;
}

export default async function handler(req: any, res: any) {
  // CORS & Preflight headers
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

  try {
    const { image, images, symbol, timeframe, tradeHistory, learnings, currentPrice } = req.body || {};

    if (!image && (!images || !Array.isArray(images) || images.length === 0)) {
      res.status(400).json({ success: false, error: "Missing uploaded chart image parameters." });
      return;
    }

    const contentParts: any[] = [];

    if (images && Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (!img) continue;
        let base64Data = img.replace(/\s+/g, "");
        let mimeType = "image/png";
        if (img.startsWith("data:")) {
          const parts = img.split(";base64,");
          if (parts.length === 2) {
            mimeType = parts[0].replace("data:", "");
            base64Data = parts[1].replace(/\s+/g, "");
          }
        }
        contentParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        });
      }
    } else if (image) {
      let base64Data = image.replace(/\s+/g, "");
      let mimeType = "image/png";
      if (image.startsWith("data:")) {
        const parts = image.split(";base64,");
        if (parts.length === 2) {
          mimeType = parts[0].replace("data:", "");
          base64Data = parts[1].replace(/\s+/g, "");
        }
      }
      contentParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    }

    const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyTimeStr);
    const nyHour = nyDate.getHours();
    const nyMin = nyDate.getMinutes();
    const nyDecimal = nyHour + nyMin / 60;

    let killZoneStatus: "ACTIVE_LONDON" | "ACTIVE_NY" | "ACTIVE_NY_PM" | "INACTIVE" = "INACTIVE";
    let killZoneName = "Inactive";
    if (nyDecimal >= 2.0 && nyDecimal <= 5.0) {
      killZoneStatus = "ACTIVE_LONDON";
      killZoneName = "London Kill Zone (2:00-5:00 AM EST / 07:00-10:00 GMT)";
    } else if (nyDecimal >= 9.5 && nyDecimal <= 12.0) {
      killZoneStatus = "ACTIVE_NY";
      killZoneName = "New York AM Kill Zone (9:30 AM-12:00 PM EST / 14:30-17:00 GMT - Strongest)";
    } else if (nyDecimal >= 15.0 && nyDecimal <= 17.0) {
      killZoneStatus = "ACTIVE_NY_PM";
      killZoneName = "London Close / NY PM Kill Zone (3:00-5:00 PM EST)";
    }

    let silverBulletStatus: "ACTIVE_LONDON" | "ACTIVE_NY_AM" | "ACTIVE_NY_PM" | "INACTIVE" = "INACTIVE";
    let silverBulletName = "Inactive";
    if (nyHour === 3) {
      silverBulletStatus = "ACTIVE_LONDON";
      silverBulletName = "London Open Silver Bullet (3-4 AM EST)";
    } else if (nyHour === 10) {
      silverBulletStatus = "ACTIVE_NY_AM";
      silverBulletName = "New York AM Session Silver Bullet (10-11 AM EST - Strongest)";
    } else if (nyHour === 14) {
      silverBulletStatus = "ACTIVE_NY_PM";
      silverBulletName = "New York PM Session Silver Bullet (2-3 PM EST)";
    }

    const customKey = (req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey;
    const ai = getGeminiClient(customKey);

    let reinforcementLearningPrompt = "";
    if (learnings && Array.isArray(learnings) && learnings.length > 0) {
      reinforcementLearningPrompt += `\nUSER-SAVED LEARNINGS/OBSERVATIONS HISTORY ("Learn from me" database):
- You MUST incorporate, respect, and apply these previous lessons, notes, or tips that the user has recorded whenever they relate to their query:
${learnings.map((l: any, i: number) => `  * Lesson #${i + 1} (${l.category || "General"} - for ${l.symbol || "General"}): ${l.learnings || l}`).join("\n")}
Acknowledge these learnings warmly to show you are aligned with their cumulative experience.
`;
    }

    if (tradeHistory && Array.isArray(tradeHistory) && tradeHistory.length > 0) {
      const wonTrades = tradeHistory.filter((t: any) => t.status === "WON");
      const lostTrades = tradeHistory.filter((t: any) => t.status === "LOST");
      const winRate = tradeHistory.length > 0 ? Math.round((wonTrades.length / tradeHistory.length) * 100) : 0;

      reinforcementLearningPrompt += `\nREINFORCEMENT LEARNING FROM USER TRADE OUTCOMES (Win/Loss, PNL, reasons):
- Total logged trades: ${tradeHistory.length}
- Win Rate: ${winRate}% (${wonTrades.length} Wins, ${lostTrades.length} Losses)
- Past Winning Setups (Strengthen these patterns):
${wonTrades.slice(0, 5).map((t: any) => `  * ${t.symbol} Setup at Entry ${t.entry_price || t.entry || "N/A"}: Won ${t.pnl || ""} PNL. Notes: ${t.notes || t.description || "N/A"}`).join("\n")}
- Past Losing Setups (Weaken/adjust these patterns to avoid repeating the same mistakes):
${lostTrades.slice(0, 5).map((t: any) => `  * ${t.symbol} Setup at Entry ${t.entry_price || t.entry || "N/A"}: Lost ${t.pnl || ""} PNL. Notes: ${t.notes || t.description || "N/A"}`).join("\n")}

- You MUST maintain a mental "win probability" estimate based on these past similar setups, adjust your recommendation to be more conservative/selective, and reference any past relevant trade outcomes in "tradeSetup.rationale" and "detailedVisualDescription".
`;
    }

    const systemPromptMessage = `You are an elite Synthetic Indices SMC Master Mentor, Computer Vision expert, and full-stack Next.js developer with deep knowledge of Deriv platform. Specialize in master-class analysis of Synthetic Indices and Smart Money Concepts. Specialize also in auto-annotating charts as a Vision system. Specifying precision confluences.

Your task is to analyze the uploaded chart screenshots (which might contain one single chart OR a set of three multi-timeframe charts: 30-minute, 4-hour, and 1-day) of ${symbol || "Synthetic Index"} and outline an executable trading plan.
${currentPrice ? `The exact live Deriv market price at the time of this scan is: **${currentPrice}**. Use this precise price to calculate extremely accurate Entry, Stop Loss, and Take Profit levels based on the structures you see.` : ""}
Look closely at the candle wicks, trend direction, order blocks, vacuums, voids, FVGs, and scale markers on the charts.

${reinforcementLearningPrompt}

CRITICAL ANALYSIS INSTRUCTIONS:
1. ASSET-SPECIFIC INSTITUTIONAL SMC KNOWLEDGE:
   - FOREX CURRENCY PAIRS INSTITUTIONAL PLAYBOOK & ANTI-STOP-LOSS ENGINE:
     * THE #1 REASON SETUPS HIT STOP LOSS (ANTI-SL HUNTING MANDATE):
       Retail traders place their Stop Loss directly on obvious swing highs, swing lows, or equal highs/lows (EQH/EQL). Institutional algorithms (banks and market makers) intentionally engineer liquidity sweeps (Judas Swing / Turtle Soup / 3-Drive Liquidity Run) that probe 3 to 10 pips past these levels before expanding toward the actual target!
     * STRUCTURAL INVALIDATION STOP LOSS PLACEMENT:
       Never place the Stop Loss right at the swing extreme or Order Block wick edge.
       The Stop Loss MUST be placed strictly beyond the structural displacement candle origin (the candle that broke structure or formed the FVG) PLUS an asset-specific spread & volatility buffer:
       - Major pairs (EUR/USD, USD/JPY, AUD/USD): Minimum 4 to 6 pips buffer beyond the structural invalidation point.
       - High volatility majors (GBP/USD, USD/CAD): Minimum 6 to 8 pips buffer.
       - Cross pairs (GBP/JPY, EUR/JPY, EUR/AUD, GBP/CAD): Minimum 10 to 15 pips buffer to absorb aggressive spread widening.
       If the required safe structural Stop Loss makes the Risk:Reward less than 1:2.5, DO NOT tighten the SL into the sweep zone; instead, calculate a deeper limit entry at OTE (0.705/0.786 Fib) inside Discount/Premium, or set tradeSetup.type to "WAIT".
     * STRICT 50% DEALING RANGE RULE (PREMIUM VS DISCOUNT):
       - NEVER suggest a BUY in Premium (>50% equilibrium of the dealing range). Longs MUST be taken in deep Discount (<50%), ideally at 0.618 - 0.786 Optimal Trade Entry (OTE).
       - NEVER suggest a SELL in Discount (<50% equilibrium of the dealing range). Shorts MUST be taken in deep Premium (>50%).
     * SESSION KILLZONES & LONDON JUDAS SWINGS:
       - Asian Session Range (19:00–00:00 EST / 00:00–05:00 UTC): Establishes the Asian High and Asian Low liquidity boundaries.
       - London Open Killzone (02:00–05:00 EST / 07:00–10:00 UTC): Over 70% of the time, the daily high or low is formed here. The London Judas Swing manipulates price by sweeping the Asian High or Low, traps breakout traders, mitigates an HTF Order Block, and then displaces in the true daily trend direction.
       - New York AM Killzone (07:00–10:00 EST / 12:00–15:00 UTC): High volatility institutional order flow. Silver Bullet window (10:00–11:00 AM EST) with clean FVG rebalances.
       - London Close / NY PM (14:00–17:00 UTC): Institutional profit taking. Stand aside from new trend continuation entries.
     * SMT (SMART MONEY TECHNIQUE) DIVERGENCE:
       - Track correlation cracks between positively correlated pairs (EUR/USD vs GBP/USD) or inversely correlated assets (DXY vs EUR/USD).
       - When EUR/USD makes a Higher High but GBP/USD fails and forms a Lower High, Smart Money is distributing — the EUR/USD high is a retail trap, expect a sharp reversal downward!
       - When EUR/USD makes a Lower Low but GBP/USD forms a Higher Low, Smart Money is accumulating — expect a sharp reversal upward!
     * RED-FOLDER HIGH-IMPACT NEWS RISK (CPI, NFP, FOMC, Rate Decisions):
       - Never enter within 15 minutes before or after red-folder news. News candles cause spread blowouts and dual-sided liquidity spikes. Wait for the post-news displacement candle, identify the new Fair Value Gap, and enter on the retest.
     * IN-TRADE RISK MANAGEMENT:
       - Minimum 1:2.5 or 1:3 Risk-to-Reward ratio required.
       - Take 50% partial profits at TP1 (first external liquidity pool) and immediately move Stop Loss to Breakeven (+1 pip buffer) to eliminate 100% of risk.

   - GOLD (XAU/USD) INSTITUTIONAL PLAYBOOK:
     * Asian Session Range Liquidity Sweeps: Asian range (00:00–06:00 GMT) establishes clean equal highs/lows. London Open (07:00–09:00 GMT / 02:00–04:00 AM EST) Judas Swing aggressively sweeps the Asian range high or low, traps retail breakout traders, then delivers price into an unmitigated 15M/1H institutional Order Block.
     * New York Kill Zone & Macro Volatility: 08:30 AM EST (CPI, NFP, PPI) and 10:00 AM EST high-impact releases engineer aggressive displacement wicks. Never chase the initial news spike; execute on the subsequent FVG rebalance and institutional mitigation block.
     * Institutional Round Psychological Numbers: Key reactions cluster around psychological levels ($10, $50, and $100 levels like $2,600, $2,650, $2,700). High probability limit entries occur at confluences between an Order Block and a round level.
     * Silver Bullet Windows: London Silver Bullet (03:00–04:00 AM EST) and NY AM Silver Bullet (10:00–11:00 AM EST) targeting 5M/15M liquidity voids.
     * Invalidation: Place Stop Loss strictly beyond the Order Block wick invalidation level with $2.50 to $3.50 buffer.

   - BITCOIN (BTC/USD) 24/7 CRYPTO SMC PLAYBOOK:
     * CME Bitcoin Futures Gap Fills: Gaps formed between Friday 17:00 EST close and Sunday 18:00 EST open act as powerful institutional magnets, with over 85% probability of being rebalanced during early week sessions.
     * Weekend Range Liquidity Engineering: Weekend consolidations build massive buy-side and sell-side liquidity pools. Sunday midnight or Monday London/NY session triggers violent manipulation sweeps (Judas swings) into deep discount zones before weekly expansion.
     * Monday Weekly Open Power of 3 (AMD): Monday sets initial reference high/low. Tuesday manipulates against trend to engineer stop runs. Wednesday through Friday distributes toward institutional HTF targets.
     * Funding Rate & Liquidation Cascade Sweeps: Aggressive wick rejections below equal lows or above equal highs trigger cascading liquidations on leverage, delivering price into pristine 1H/4H Breaker Blocks or Order Blocks.

   - DERIV SYNTHETIC INDICES KNOWLEDGE:
     * Volatility Indices (especially V75, V100): High continuous algorithmic volatility, clean structural trends, pristine Fair Value Gaps and order block reactions.
     * Boom/Crash Indices: Steady stair-step trends with explosive opposite-direction tick spikes.
     * 24/7 algorithmic execution, unaffected by real-world news prints. V75 is preferred for SMC due to balanced, high-precision movement.

2. MULTI-TIMEFRAME ANALYSIS:
   When user uploads 3 images:
   - Image 1: 30-minute (entry precision)
   - Image 2: 4-hour (structure)
   - Image 3: 1-day (overall bias)
   Always confirm all three timeframes and do top-down analysis. Focus entry detail especially on the 30M chart.

3. MASTER-CLASS STRATEGIES + STRICT FILTERING:
   - Full SMC/ICT: Order Blocks, BOS/CHOCH, FVG, Liquidity Voids/Vacuum Blocks, Supply/Demand, Fibonacci (0.618/0.786), Candlesticks.
   - ICT Kill Zones, Silver Bullet, CRT, Judas Swing, AMD / Power of 3.
   - STRICT FILTERING:
     - ONLY give signals with 4+ strong confluences.
     - Required: Order Block + Liquidity Void/FVG + Fib level + CRT/Judas Swing/AMD/Silver Bullet confirmation. If any of these is absent or fewer than 4 confluences, you MUST set "tradeSetup.type" to "WAIT".
     - Prefer Buy Limit entries at strong zones.

4. COMPUTER VISION AI SCANNER:
   In detailedVisualDescription, explain how the AI scanner registers and drafts the annotation elements on the 30M entry chart:
   - Order Blocks (shaded rectangles).
   - Liquidity Voids (dashed purple boundaries).
   - Vacuum Blocks (faded gradient boxes).
   - Fib lines (horizontal levels).
   - CRT ranges (bracketed highs and lows).
   - Judas Swing (false breakout sweep markers).
   - AMD phases (Accumulation box, Manipulation sweep, Distribution vector).
   - Silver Bullet FVGs (highlighted zones).
   - Entry (cyan limit line), stop-loss SL (red line), and take-profits TP1/TP2 (green lines).

5. PRECISION SETUP OUTPUT:
   Structure your detailed technical fields to integrate this sequence:
   1. Image Quality Assessment (30M / 4H / 1D)
   2. 1D Higher Timeframe Bias
   3. 4H Structure & Key Confluences
   4. 30M Entry Precision (Buy Limit preferred)
   5. Overall Confluence Score + Final Recommendation
   6. Risk Warning: Max 1% risk per trade.

You MUST respond strictly with a valid JSON object matching this schema. Do not add any extra markdown wrapping (\`\`\`json):

{
  "imageQuality": {
    "status": "passed" | "failed",
    "details": "Technical review of screenshot clarity"
  },
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "marketStructure": "Structural description (e.g. Bullish BOS, Liquidity swept, or Bearish CHoCH)",
  "confluenceScore": 4.5,
  "antiStopLossShield": {
    "structuralInvalidationPrice": 1.0820,
    "bufferPipsApplied": 5.0,
    "protectionRationale": "Stop Loss placed safely behind structural displacement origin + buffer rather than obvious retail swing wick to avoid stop hunts",
    "dealingRangePosition": "DISCOUNT_OTE" | "PREMIUM_OTE" | "EQUILIBRIUM"
  },
  "killZone": {
    "status": "ACTIVE_LONDON" | "ACTIVE_NY" | "ACTIVE_NY_PM" | "INACTIVE",
    "windowName": "Window name",
    "details": "Kill Zone analysis for ${killZoneName}"
  },
  "silverBullet": {
    "status": "ACTIVE_LONDON" | "ACTIVE_NY_AM" | "ACTIVE_NY_PM" | "INACTIVE",
    "windowName": "Window name",
    "details": "Silver Bullet analysis for ${silverBulletName}"
  },
  "candleRangeTheory": {
    "rangeHigh": 1620.00,
    "rangeLow": 1540.00,
    "sweepType": "HIGH_SWEPT" | "LOW_SWEPT" | "NONE",
    "deliveryDirection": "BULLISH" | "BEARISH" | "NEUTRAL",
    "description": "Candle Range Theory explanation"
  },
  "judasSwing": {
    "detected": true,
    "direction": "BULLISH" | "BEARISH" | "NEUTRAL",
    "triggerLevel": 1622.50,
    "description": "Judas Swing details"
  },
  "powerOf3": {
    "detected": true,
    "accumulationRange": "1545.00 - 1558.00",
    "manipulationLevel": 1538.50,
    "distributionTarget": 1595.00,
    "description": "Power of 3 description"
  },
  "multiTimeframe": {
    "isMultiTimeframe": true,
    "htfBias1D": "Macro bias on 1D",
    "intermediateStructure4H": "Structure on 4H",
    "entryPrecision30M": "Micro precision on 30M",
    "confirmationMessage": "Confirmation verification"
  },
  "suggestedRisk": "Suggested risk allocation",
  "doActions": ["Action 1", "Action 2"],
  "dontActions": ["Warning 1", "Warning 2"],
  "detailedVisualDescription": "Technical summary of detected chart elements",
  "orderBlock": {
    "priceRange": "Price boundary",
    "type": "Type name",
    "rationale": "SMC rationale"
  },
  "supplyDemandZones": {
    "supply": "Supply area",
    "demand": "Demand area",
    "activeZone": "Active zone"
  },
  "liquidityVoid": {
    "priceRange": "Void boundaries",
    "description": "Imbalance details"
  },
  "vacuumBlock": {
    "priceRange": "Vacuum boundaries",
    "description": "Spike details"
  },
  "candlestickPatterns": {
    "patternName": "Pattern name",
    "context": "Context description"
  },
  "fibonacciRetracement": {
    "level_50": 0.50,
    "level_618": 0.618,
    "level_786": 0.786,
    "description": "Fibonacci confluence description"
  },
  "tradeSetup": {
    "type": "BUY" | "SELL" | "WAIT",
    "entry": 1560.50,
    "stopLoss": 1538.00,
    "takeProfits": [1590.00, 1610.00, 1635.00],
    "riskRewardRatio": "1:3.2",
    "rationale": "Rationale"
  },
  "educationalInsight": "Educational lesson"
};`;

    const textPart = {
      text: `Analyze the provided chart screenshot(s) for ${symbol || "Synthetic Index"} under the ${timeframe || "30M"} timeframe according to Smart Money Concepts (SMC), Supply and Demand, and Fibonacci retracement mechanics. Estimate logical numerical index parameters for the entry, stop-loss, and take-profit targets based on the charts' visible numbers/ranges. Only offer a BUY/SELL signal if we have 4+ confluences, otherwise set to WAITING.`,
    };

    const response = await generateGeminiContent(ai, "gemini-3.8-flash", {
      model: "gemini-3.8-flash",
      contents: {
        parts: [...contentParts, textPart],
      },
      config: {
        systemInstruction: systemPromptMessage,
        responseMimeType: "application/json",
        temperature: 0.15,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response output returned from the Gemini modeling endpoint.");
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText.trim());
    } catch {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    res.status(200).json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error("Gemini Analysis Server Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during AI analysis. Ensure the Gemini API key is valid.",
    });
  }
}
