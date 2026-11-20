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
        return await ai.models.generateContent({
          ...params,
          model: modelName,
          config: sanitizedConfig,
        });
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err?.status || "").toLowerCase();
        const isAuthFatal =
          errMsg.includes("api_key_invalid") ||
          errMsg.includes("api key not valid") ||
          err?.status === 401 ||
          err?.status === 403;
        if (isAuthFatal) throw err;
        if (attempt < 2) await delayHelper(attempt * 700);
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
    const { subject, explanation } = req.body || {};
    if (!subject) {
      res.status(400).json({ success: false, error: "Missing educational diagram subject requested." });
      return;
    }

    const customKey = (req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey;
    const ai = getGeminiClient(customKey);

    const svgSystemPrompt = `You are an institutional trading diagram designer.
Produce a complete, self-contained valid raw SVG file (width 800, height 500) illustrating Smart Money Concepts.
Use a crisp slate dark canvas (#0F172A), subtle gridlines (#1E293B), emerald green bullish zones (#10B981), rose invalidation levels (#F43F5E), and clean monospace labels.
Output ONLY raw SVG starting with "<svg" and ending with "</svg>". No markdown code fences.`;

    const response = await generateGeminiContent(ai, "gemini-4-hydrogen", {
      contents: `Generate a clean institutional trading schematic SVG for: ${subject}. Context: ${explanation || "SMC Order Block & OTE Liquidity Sweep"}.`,
      config: {
        systemInstruction: svgSystemPrompt,
      },
    });

    let rawSvg = response.text?.trim() || "";
    if (rawSvg.startsWith("```")) {
      rawSvg = rawSvg.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
    }

    if (!rawSvg.startsWith("<svg")) {
      rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
        <rect width="800" height="500" fill="#0f172a" rx="12" />
        <text x="400" y="220" fill="#10b981" font-family="monospace" font-size="22" font-weight="bold" text-anchor="middle">SMC SCHEMATIC: ${String(subject).toUpperCase().replace(/[<>&"]/g, "")}</text>
        <text x="400" y="260" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">Liquidity Sweep → Displacement BOS → 0.705 OTE Order Block Mitigation</text>
      </svg>`;
    }

    const base64Svg = Buffer.from(rawSvg).toString("base64");
    res.status(200).json({
      success: true,
      imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
      svg: rawSvg,
    });
  } catch (error: any) {
    console.error("Diagram Builder Exception:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to compile schematic illustration.",
    });
  }
}
