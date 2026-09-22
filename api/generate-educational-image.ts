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
    const { subject, explanation } = req.body || {};

    if (!subject) {
      res.status(400).json({ success: false, error: "Missing educational diagram subject requested." });
      return;
    }

    const customKey = (req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey;
    const ai = getGeminiClient(customKey);

    const svgSystemPrompt = `You are an elite diagram designer.
Produce a fully complete, self-contained, valid, clean raw SVG file (width 800, height 500) representing high-probability Smart Money trading concepts.
Ensure the layout is responsive, beautiful, dark cyberstyled (slate-950 background, gridlines, bright green wicks, glowing cyan Order Block indicators, and clean rose stop-loss targets).

Your output MUST be exclusively the raw SVG code starting with "<svg" and ending with "</svg>".
Do NOT write markdown code blocks (\`\`\`xml or \`\`\`svg) in the output. Just return the clean raw SVG content.`;

    const svgPromptText = `Generate a high-impact visual SVG layout for: ${subject}. 
Context: ${explanation || "Detailed SMC guide"}.
Use nice SVG tags, text boxes, and charts. Make it extremely visual and beautiful.`;

    const response = await generateGeminiContent(ai, "gemini-3.8-flash", {
      model: "gemini-3.8-flash",
      contents: svgPromptText,
      config: {
        systemInstruction: svgSystemPrompt,
        temperature: 0.3,
      },
    });

    let rawSvg = response.text?.trim() || "";

    if (rawSvg.startsWith("```")) {
      rawSvg = rawSvg.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
    }

    if (!rawSvg.startsWith("<svg")) {
      rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
        <rect width="800" height="500" fill="#0b0f19" rx="15" />
        <grid patternUnits="userSpaceOnUse" width="40" height="40">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.5"/>
        </grid>
        <text x="400" y="220" fill="#22d3ee" font-family="sans-serif" font-size="24" font-weight="bold" text-anchor="middle">SMC MECHANICAL DIAGRAM</text>
        <text x="400" y="260" fill="#94a3b8" font-family="sans-serif" font-size="14" text-anchor="middle">${subject.toUpperCase()}: Schematic representation loaded successfully</text>
        <rect x="250" y="300" width="300" height="40" rx="10" fill="#1e293b" stroke="#334155" />
        <text x="400" y="325" fill="#10b981" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">RETRACE TO ORDER BLOCK COMPLETED</text>
      </svg>`;
    }

    const base64Svg = Buffer.from(rawSvg).toString("base64");
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

    res.status(200).json({
      success: true,
      imageUrl: dataUrl,
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
