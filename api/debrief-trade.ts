import { GoogleGenAI } from "@google/genai";

function getGeminiClient(customKey?: string): GoogleGenAI {
  const rawKey = customKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-gemini-key");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
    return;
  }

  const { trade } = req.body || {};
  if (!trade || !trade.symbol) {
    res.status(400).json({ success: false, error: "Missing trade payload for debrief." });
    return;
  }

  const normalizedStopLoss = trade.stop_loss ?? trade.sl_price ?? "your planned stop";
  const normalizedTakeProfit = trade.take_profit ?? trade.tp_price ?? "your target";
  const normalizedStatus = trade.status ?? trade.result ?? "CLOSED";
  const normalizedBias = trade.bias ?? trade.direction ?? "N/A";

  try {
    const customKey = (req.headers["x-gemini-key"] as string) || req.body?.geminiApiKey;
    const ai = getGeminiClient(customKey);

    const prompt = `Review this closed retail trade and give a concise, practical post-trade debrief in simple English (NO institutional bank jargon):

Trade Details:
- Symbol: ${trade.symbol}
- Timeframe: ${trade.timeframe || "M15"}
- Style: ${trade.trading_style || "NORMAL"}
- Direction Bias: ${normalizedBias}
- Entry Price: ${trade.entry_price}
- Stop Loss: ${normalizedStopLoss}
- Take Profit: ${normalizedTakeProfit}
- Exit Price: ${trade.exit_price ?? "N/A"}
- Risk/Reward Planned: ${trade.risk_reward || "N/A"}
- Result Status: ${normalizedStatus}
- Realized P&L: ${trade.pnl !== undefined && trade.pnl !== null ? `$${trade.pnl}` : "N/A"}
- Trader Notes: ${trade.notes || "None provided"}

Respond strictly as raw valid JSON with this exact shape:
{
  "headline": "Short 5-8 word takeaway",
  "whatWorked": "1-2 plain sentences on what was done well",
  "whatToImprove": "1-2 plain sentences on the main lesson or mistake to watch next time",
  "suggestedRule": "One crisp, concrete 1-sentence personal trading rule (under 180 chars) to save to the trader's AI playbook",
  "ruleCategory": "Scalp Rules" | "Stop Loss" | "Entry Timing" | "Risk Management" | "Psychology"
}`;

    const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
    let raw = "";
    let lastErr: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction:
              "You are a direct, encouraging retail trading coach helping an everyday trader learn from their own closed trades and build a personal rulebook.",
            responseMimeType: "application/json",
          },
        });
        raw = (response.text || "").trim();
        if (raw) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!raw) throw lastErr || new Error("Empty debrief response");

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
    }

    res.status(200).json({ success: true, data: parsed });
  } catch (err: any) {
    const isWin = normalizedStatus === "WON" || normalizedStatus === "WIN";
    res.status(200).json({
      success: true,
      data: {
        headline: isWin
          ? `Clean ${trade.symbol} Execution — Repeat What Worked`
          : `Protect Capital & Tighten Entry Selection on ${trade.symbol}`,
        whatWorked: isWin
          ? `Your ${trade.trading_style === "SCALP" ? "scalp" : "trade"} direction aligned with price momentum and reached target cleanly.`
          : `You kept your loss defined with a Stop Loss at ${normalizedStopLoss}, keeping your account protected.`,
        whatToImprove: isWin
          ? `Journal the exact session time and candle confirmation so you can spot this exact ${trade.symbol} setup again.`
          : `Check whether entry was slightly early before a pullback or if the Stop Loss sat too close to a recent wick.`,
        suggestedRule: isWin
          ? `On ${trade.symbol} (${trade.timeframe || "M15"}), stick to ${trade.trading_style === "SCALP" ? "quick scalps" : "pullback entries"} with a defined ${trade.risk_reward || "1:2"} plan.`
          : `On ${trade.symbol} (${trade.timeframe || "M15"}), wait for a confirmed rejection candle before entering and keep SL safely beyond the recent wick.`,
        ruleCategory: isWin ? "Entry Timing" : "Stop Loss",
      },
    });
  }
}
