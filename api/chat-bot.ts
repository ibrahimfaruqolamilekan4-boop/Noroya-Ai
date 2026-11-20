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
  const uniqueModels = Array.from(
    new Set([primaryModel, "gemini-4-hydrogen", "gemini-3.1-flash-lite"])
  );
  const delayHelper = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  let lastError: any = null;

  for (const modelName of uniqueModels) {
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
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err?.status || "").toLowerCase();
        const isAuthFatal =
          errMsg.includes("api_key_invalid") ||
          errMsg.includes("api key not valid") ||
          errMsg.includes("unauthorized") ||
          err?.status === 401 ||
          err?.status === 403;

        if (isAuthFatal) throw err;
        if (attempt < 2) await delayHelper(attempt * 600);
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
    const { prompt, history, currentAnalysis, tradeHistory, learnings, educationalMode, chartImage, activeSymbol } =
      req.body || {};

    if (!prompt) {
      res.status(400).json({ success: false, error: "No prompt message provided." });
      return;
    }

    const customKey = (req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey;
    const ai = getGeminiClient(customKey);

    let companionDirective = `You are a disciplined, institutional SMC (Smart Money Concepts) Mentor and Chief Risk Officer specializing in:
1. Forex Majors & Crosses (Anti-SL hunting buffers behind displacement origins, 50% Premium/Discount rule, London Judas Swings, NY AM Silver Bullet 10:00–11:00 EST, paired SMT Divergence).
2. Metals & Global Indices (XAU/USD psychological handles, US100/US500 SMT correlation, Asian range sweeps).
3. Crypto Perpetual Futures (Bybit Funding Rates, 24h Open Interest Δ 4-quadrant regimes, live tape CVD absorption/distribution, CME gaps).
4. Deriv Synthetic Indices (20-period Z-Score ±2.5σ mean reversion on Volatility indices, pre-spike compression & inter-spike intervals on Boom/Crash).

Always emphasize capital preservation, strict >= 1:2.0 Risk:Reward, and standing aside (WAIT) when confluence is weak.
Active instrument on screen: ${activeSymbol ? `${activeSymbol.name} (${activeSymbol.ticker})` : "General"}.
`;

    if (educationalMode) {
      companionDirective += `EDUCATIONAL MODE: Explain mechanical SMC rules clearly with structured bullets and optional short comprehension checks.\n`;
    } else {
      companionDirective += `TACTICAL MODE: Be concise and precise with exact invalidation, OTE entry, and partial-profit management.\n`;
    }

    if (currentAnalysis) {
      companionDirective += `\nCURRENT ON-SCREEN ANALYSIS:\n- Bias: ${currentAnalysis.bias || "N/A"}\n- Structure: ${currentAnalysis.marketStructure || "N/A"}\n- Order Block: ${JSON.stringify(currentAnalysis.orderBlock || {})}\n- Trade Setup: ${JSON.stringify(currentAnalysis.tradeSetup || {})}\n`;
    }

    if (Array.isArray(learnings) && learnings.length > 0) {
      companionDirective += `\nUSER SAVED LEARNINGS:\n${learnings
        .map((l: any, i: number) => `- [#${i + 1}]: ${l.learnings || l} (${l.category || "General"})`)
        .join("\n")}\n`;
    }

    if (Array.isArray(tradeHistory) && tradeHistory.length > 0) {
      const won = tradeHistory.filter((t: any) => t.status === "WON").length;
      const lost = tradeHistory.filter((t: any) => t.status === "LOST").length;
      const total = tradeHistory.length;
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
      companionDirective += `\nUSER TRADING LOG: ${total} trades, ${winRate}% win rate (${won}W / ${lost}L).\n`;
    }

    const contents: any[] = [];
    if (Array.isArray(history)) {
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
        currentParts.push({ inlineData: { mimeType, data: base64Data } });
      }
    }

    currentParts.push({ text: prompt });
    contents.push({ role: "user", parts: currentParts });

    const response = await generateGeminiContent(ai, "gemini-4-hydrogen", {
      contents,
      config: {
        systemInstruction: companionDirective,
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
