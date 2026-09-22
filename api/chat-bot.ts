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
    modelsToTry.push("gemini-3.1-flash-lite");
  } else {
    modelsToTry.push("gemini-3.8-flash");
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

    let companionDirective = `You are a legendary Synthetic Indices SMC (Smart Money Concepts) Elite Mentor and risk specialist Coach with deep expertise in Deriv-style synthetic markets: Volatility Indices (V75, V100), Boom/Crash Indices, Step Index, and Jump Indices.
Provide professional, crisp, and high-value trading advice. Encourage strict risk management (1-2% rule).

The active index currently selected on screen is: ${activeSymbol ? `${activeSymbol.name} (${activeSymbol.ticker})` : "General/Unspecified"}.
`;

    if (educationalMode) {
      companionDirective += `EDUCATIONAL MODE IS ON:
- Break down concepts step-by-step with clear definitions (e.g., Order Block, CHoCH vs BOS, liquidity pools, FVGs).
- Avoid dry answers; use clean typographic layouts (bullet points, markdown tables).
- Frequently challenge the student with interactive quizzes! Offer multiple options (A, B, or C) and explain the mechanical answer when they respond.
`;
    } else {
      companionDirective += `TACTICAL MODE IS ON:
- Be highly precise, concise, and focused on immediate mechanical trade setups.
- Use bullet points for entry, stop loss, and target instructions.
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
- Favorite Indices: ${Array.from(new Set(tradeHistory.map((t: any) => t.symbol))).slice(0, 3).join(", ")}
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

    if (chartImage) {
      let base64Data = chartImage.replace(/\s+/g, "");
      let mimeType = "image/png";
      if (chartImage.startsWith("data:")) {
        const parts = chartImage.split(";base64,");
        if (parts.length === 2) {
          mimeType = parts[0].replace("data:", "");
          base64Data = parts[1].replace(/\s+/g, "");
        }
      }
      currentParts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    currentParts.push({ text: prompt });
    contents.push({ role: "user", parts: currentParts });

    const response = await generateGeminiContent(ai, "gemini-3.8-flash", {
      model: "gemini-3.8-flash",
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
