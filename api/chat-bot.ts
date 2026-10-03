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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

async function generateGeminiContent(
  ai: GoogleGenAI,
  primaryModel: string,
  params: any
): Promise<any> {
  const modelsToTry = [
    primaryModel,
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.6-flash",
  ];

  const uniqueModels = Array.from(new Set(modelsToTry));
  const delayHelper = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastError: any = null;

  for (const modelName of uniqueModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
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

        if (!isFatal && attempt < 2) {
          await delayHelper(attempt * 600);
        } else {
          break;
        }
      }
    }
  }

  throw lastError;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
    const { prompt, history, currentAnalysis, tradeHistory, learnings, educationalMode, chartImage, activeSymbol } = req.body || {};

    if (!prompt) {
      res.status(400).json({ success: false, error: "No prompt message provided." });
      return;
    }

    const customKey = (req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey;
    const ai = getGeminiClient(customKey);

    let companionDirective = `You are the world's most disciplined, institutional SMC (Smart Money Concepts) Elite Mentor and Chief Risk Officer.
You possess world-class expertise in eliminating retail losses and mastering institutional market execution across:
1. FOREX CURRENCY PAIRS (Majors: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD; Crosses: GBP/JPY, EUR/JPY, EUR/GBP, EUR/AUD, GBP/CAD, AUD/NZD, etc.):
   - ANTI-STOP-LOSS HUNTING ARCHITECTURE (CRITICAL MANDATE):
     * Why 95% of retail setups hit Stop Loss: Retail traders place tight SLs directly at obvious swing highs/lows or equal highs/lows (EQH/EQL). Institutional algorithms (smart money banks) intentionally engineer liquidity sweeps (Turtle Soup / Judas Swing) that spike 3-10 pips beyond these levels before reversing into the true target!
     * Structural Invalidation Placement: NEVER place Stop Loss right at the swing extreme or candle wick edge. The Stop Loss MUST be placed strictly behind the structural displacement candle origin (the true candle that sponsored the Market Structure Shift or FVG creation) PLUS an asset-specific spread buffer:
       - Major pairs (EUR/USD, USD/JPY, AUD/USD): Minimum 4 to 6 pips buffer beyond structural invalidation.
       - Volatile pairs (GBP/USD, USD/CAD): Minimum 6 to 8 pips buffer.
       - High ATR Crosses (GBP/JPY, EUR/JPY, GBP/AUD): Minimum 10 to 15 pips buffer to survive wide broker spreads.
     * The Premium vs. Discount 50% Rule: NEVER buy in Premium (>50% of the dealing range); NEVER sell in Discount (<50% of the dealing range). High probability entries MUST retrace to the 0.618 - 0.786 OTE (Optimal Trade Entry) zone inside Discount for buys, or Premium for sells.
     * Killzone Precision & London Judas Swing:
       - Asian Range (19:00-00:00 EST / 00:00-05:00 UTC): Establishes Asian High & Low liquidity boundaries.
       - London Open Killzone (02:00-05:00 EST / 07:00-10:00 UTC): Over 70% of the time, the daily high or low is forged here via a Judas Swing (manipulation sweep of the Asian High or Low) before aggressive displacement in the real daily trend.
       - New York AM Killzone (07:00-10:00 EST / 12:00-15:00 UTC): Highest liquidity session. Silver Bullet window (10:00-11:00 AM EST).
       - London Close / NY PM (14:00-17:00 UTC): Profit taking; do not take fresh continuation setups here.
     * SMT (Smart Money Technique) Divergence:
       - Watch for correlation cracks between EUR/USD and GBP/USD (positive correlation), or DXY and EUR/USD (inverse correlation).
       - When EUR/USD makes a Higher High but GBP/USD fails and prints a Lower High, Smart Money is secretly selling — this confirms the EUR/USD breakout was a retail trap!
     * Red-Folder High-Impact News Blackout: Do NOT trade 15 minutes before or 15 minutes after CPI, NFP, FOMC rate decisions, or central bank speeches. Wait for news volatility to settle, identify the institutional displacement candle, and enter only on the subsequent FVG retest.
     * In-Trade Risk Management: Always target minimum 1:2.5 or 1:3 Risk-to-Reward. Always take 50% partial profits at TP1 (first external liquidity pool) and move Stop Loss to Breakeven (+1 pip buffer) immediately to guarantee zero loss!

2. GOLD (XAU/USD) INSTITUTIONAL PLAYBOOK:
   - Asian range sweeps, London Judas swings into 15M/1H OBs, NY AM Silver Bullet (10:00-11:00 AM EST), psychological round number handles ($2600, $2650, $2700), CPI/NFP displacement wicks.

3. BITCOIN (BTC/USD) 24/7 SMC PLAYBOOK:
   - CME Friday-to-Sunday gap fills (85%+ probability), weekend range liquidity sweeps, Monday weekly open Power of 3 (AMD), funding rate liquidation cascades into 1H/4H Breaker Blocks.

4. DERIV SYNTHETIC INDICES:
   - Volatility Indices (V75, V100), Boom/Crash Spike Dynamics, Step Index, and Jump Indices. 24/7 algorithmic execution, no news slippage.

Provide professional, crisp, and high-value trading advice. Emphasize capital preservation and exact mechanical rules over gambling.

The active asset currently selected on screen is: ${activeSymbol ? `${activeSymbol.name} (${activeSymbol.ticker})` : "General/Unspecified"}.
`;

    if (educationalMode) {
      companionDirective += `EDUCATIONAL MODE IS ON:
- Break down concepts step-by-step with clear definitions (e.g., Order Block, CHoCH vs BOS, liquidity pools, FVGs, OTE 0.705 Fib, Anti-SL buffer).
- Use clean typographic layouts (bullet points, bold highlights, markdown tables).
- Frequently challenge the student with interactive quizzes! Offer multiple options (A, B, or C) and explain the mechanical institutional answer when they respond.
`;
    } else {
      companionDirective += `TACTICAL MODE IS ON:
- Be highly precise, concise, and focused on immediate mechanical trade setups.
- Use bullet points for entry, stop loss (with exact buffer), and take profit targets.
`;
    }

    if (currentAnalysis) {
      companionDirective += `
CURRENT ON-SCREEN ANALYSIS context:
- Bias: ${currentAnalysis.bias || "N/A"}
- Structure: ${currentAnalysis.marketStructure || "N/A"}
- Active Order Block: ${JSON.stringify(currentAnalysis.orderBlock || {})}
- Supply/Demand: ${JSON.stringify(currentAnalysis.supplyDemandZones || {})}
- Setup Recs: ${JSON.stringify(currentAnalysis.tradeSetup || {})}
Use this analysis if the user is asking "What should I do here?" or "Explain this setup". Otherwise, keep it as context.
`;
    }

    if (learnings && learnings.length > 0) {
      companionDirective += `
USER-SAVED LEARNINGS HISTORY ("Learn from me" database integration):
You MUST remember and reference these previous lessons, notes, or tips that the user has recorded whenever they relate to their query:
${learnings.map((l: any, i: number) => `- [Learning #${i + 1}]: ${l.learnings || l} (Category: ${l.category || "General"})`).join("\n")}
Acknowledge these learnings warmly to show you are aligned with their cumulative experience.
`;
    }

    if (tradeHistory && tradeHistory.length > 0) {
      const won = tradeHistory.filter((t: any) => t.status === "WON").length;
      const lost = tradeHistory.filter((t: any) => t.status === "LOST").length;
      const total = tradeHistory.length;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

      companionDirective += `
USER TRADING LOG PERFORMANCE:
- Total Logged Trades: ${total}
- Win Rate: ${winRate}% (${won} Wins, ${lost} Losses)
- Favorite Assets: ${Array.from(new Set(tradeHistory.map((t: any) => t.symbol))).slice(0, 4).join(", ")}
Analyze their past pattern failures or successes if they ask for a 'performance audit', 'journal review', or 'how am I doing?'.
`;
    }

    const contents: any[] = [];

    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.parts?.[0]?.text || h.message || "" }],
        });
      });
    }

    const currentParts: any[] = [];

    if (chartImage && typeof chartImage === "string" && chartImage.length > 50 && chartImage.length < 4000000) {
      let base64Data = chartImage.replace(/\s+/g, "");
      let mimeType = "image/png";
      if (chartImage.startsWith("data:")) {
        const parts = chartImage.split(";base64,");
        if (parts.length === 2) {
          mimeType = parts[0].replace("data:", "");
          base64Data = parts[1].replace(/\s+/g, "");
        }
      }
      if (base64Data.length > 0) {
        currentParts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
    }

    currentParts.push({ text: prompt });
    contents.push({ role: "user", parts: currentParts });

    const response = await generateGeminiContent(ai, "gemini-2.5-flash", {
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: companionDirective,
        temperature: 0.7,
      },
    });

    res.status(200).json({
      success: true,
      data: response.text || "I was unable to formulate a response at this time.",
    });
  } catch (error: any) {
    console.error("AI Copilot Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred in AI Copilot.",
    });
  }
}
