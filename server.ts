import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { syncProjectToGitHub } from "./scripts/github-sync";

dotenv.config();

const app = express();
const PORT = 3000;

// Set body parser limits to support base64 screenshots of chart images
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Lazy initializer for the Google Gen AI client following best practices
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("SYSTEM_ERROR: GEMINI_API_KEY is not configured in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Robust fallback & retry wrapper to resolve temporary Gemini 503 "High Demand" model overloading
async function generateGeminiContent(
  ai: GoogleGenAI,
  primaryModel: string,
  params: any
): Promise<any> {
  const modelsToTry = [primaryModel];
  
  if (primaryModel === "gemini-3.5-flash") {
    modelsToTry.push("gemini-3.1-flash-lite", "gemini-flash-latest");
  } else if (primaryModel === "gemini-3.1-flash-lite") {
    modelsToTry.push("gemini-3.5-flash", "gemini-flash-latest");
  } else if (primaryModel === "gemini-flash-latest") {
    modelsToTry.push("gemini-3.5-flash", "gemini-3.1-flash-lite");
  } else {
    modelsToTry.push("gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest");
  }

  // Deduplicate model list to maintain clean sequential order
  const uniqueModels = Array.from(new Set(modelsToTry));
  const delayHelper = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastError: any = null;

  for (const modelName of uniqueModels) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Gemini Fallback System] Routing request to ${modelName} (Attempt ${attempt}/3)...`);
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
        
        // Critical key or configuration issues are fatal. Everything else (spikes, high demand, 503, ratelimits, server overloads) is transient and should trigger fallback.
        const isFatal = 
          combinedErrorString.includes("api_key_invalid") || 
          combinedErrorString.includes("api key not valid") || 
          combinedErrorString.includes("invalid key") ||
          combinedErrorString.includes("unauthorized") ||
          combinedErrorString.includes("bad credentials") ||
          err.status === 400 || err.status === 401 || err.status === 403;

        const isTransientError = !isFatal;

        console.warn(
          `[Gemini Fallback System] Model ${modelName} (Attempt ${attempt}/3) returned error:`, 
          err.message || err
        );

        if (isTransientError && attempt < 3) {
          const waitTime = attempt * 1000; // Step wait: 1s, 2s
          console.log(`[Gemini Fallback System] Non-fatal issue detected. Retrying model ${modelName} in ${waitTime}ms...`);
          await delayHelper(waitTime);
        } else {
          // If it's a non-transient error or we've run out of attempts on this model, break the inner loop to try the next model
          break;
        }
      }
    }
  }

  // If we exhausted all fallback options, propagate the final error
  throw lastError;
}

// ----------------------------------------------------
// API ENDPOINTS
// ----------------------------------------------------

// Health Check API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Chart Analysis endpoint
app.post("/api/analyze-chart", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { image, images, symbol, timeframe, tradeHistory, learnings } = req.body;

    if (!image && (!images || !Array.isArray(images) || images.length === 0)) {
      res.status(400).json({ error: "Missing uploaded chart image parameters." });
      return;
    }

    // Convert all inputs to Gemini parts
    const contentParts: any[] = [];

    if (images && Array.isArray(images) && images.length > 0) {
      // Multiple images provided for top-down multi-timeframe analysis
      for (const img of images) {
        if (!img) continue;
        let base64Data = img;
        let mimeType = "image/png";
        if (img.startsWith("data:")) {
          const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }
        }
        contentParts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          }
        });
      }
    } else if (image) {
      // Standard single-image fallback
      let base64Data = image;
      let mimeType = "image/png";
      if (image.startsWith("data:")) {
        const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }
      contentParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        }
      });
    }

    // Calculate current New York time (EST/EDT) for the time-based Silver Bullet Strategy
    const nyTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyTimeStr);
    const nyHour = nyDate.getHours();
    const nyMin = nyDate.getMinutes();
    const nyDecimal = nyHour + (nyMin / 60);
    
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

    const ai = getGeminiClient();

    let reinforcementLearningPrompt = "";
    if (learnings && Array.isArray(learnings) && learnings.length > 0) {
      reinforcementLearningPrompt += `\nUSER-SAVED LEARNINGS/OBSERVATIONS HISTORY ("Learn from me" database):
- You MUST incorporate, respect, and apply these previous lessons, notes, or tips that the user has recorded whenever they relate to their query:
${learnings.map((l: any, i: number) => `  * Lesson #${i + 1} (${l.category || 'General'} - for ${l.symbol || 'General'}): ${l.learnings || l}`).join("\n")}
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
${wonTrades.slice(0, 5).map((t: any, i: number) => `  * ${t.symbol} Setup at Entry ${t.entry_price || t.entry || 'N/A'}: Won ${t.pnl || ''} PNL. Notes: ${t.notes || t.description || 'N/A'}`).join("\n")}
- Past Losing Setups (Weaken/adjust these patterns to avoid repeating the same mistakes):
${lostTrades.slice(0, 5).map((t: any, i: number) => `  * ${t.symbol} Setup at Entry ${t.entry_price || t.entry || 'N/A'}: Lost ${t.pnl || ''} PNL. Notes: ${t.notes || t.description || 'N/A'}`).join("\n")}

- You MUST maintain a mental "win probability" estimate based on these past similar setups, adjust your recommendation to be more conservative/selective, and reference any past relevant trade outcomes (e.g. "Similar to your previous winning setup on ${symbol} near entry...", or "Adjusting our Entry lower to avoid the previous loss scenario on ${symbol}...") in "tradeSetup.rationale" and "detailedVisualDescription".
`;
    }

    const systemPromptMessage = `You are an elite Synthetic Indices SMC Master Mentor, Computer Vision expert, and full-stack Next.js developer with deep knowledge of Deriv platform. Specialize in master-class analysis of Synthetic Indices and Smart Money Concepts. Specialize also in auto-annotating charts as a Vision system. Specifying precision confluences.
 
Your task is to analyze the uploaded chart screenshots (which might contain one single chart OR a set of three multi-timeframe charts: 30-minute, 4-hour, and 1-day) of ${symbol || 'Synthetic Index'} and outline an executable trading plan.
Look closely at the candle wicks, trend direction, order blocks, vacuums, voids, FVGs, and scale markers on the charts.

${reinforcementLearningPrompt}
 
CRITICAL ANALYSIS INSTRUCTIONS:
1. DERIV SYNTHETIC INDICES KNOWLEDGE:
   - Volatility Indices (especially V75): Constant high volatility, clean trends & retracements.
   - Boom/Crash Indices: Long calm periods + sudden violent spikes.
   - 24/7 market, fixed algorithmic volatility, best during 07:00–16:00 GMT. V75 is the most popular for SMC due to balanced, high-precision movement.

2. MULTI-TIMEFRAME ANALYSIS:
   When user uploads 3 images (or when isMultiTimeframe is active):
   - Image 1: 30-minute (entry precision)
   - Image 2: 4-hour (structure)
   - Image 3: 1-day (overall bias)
   Always confirm all three timeframes and do top-down analysis. Focus entry detail especially on the 30M chart.

3. MASTER-CLASS STRATEGIES + STRICT FILTERING:
   - Full SMC/ICT: Order Blocks, BOS/CHOCH, FVG, Liquidity Voids/Vacuum Blocks, Supply/Demand, Fibonacci (0.618/0.786), Candlesticks.
   - ICT Kill Zones, Silver Bullet, CRT, Judas Swing, AMD / Power of 3.
   - ICT Silver Bullet: Time windows: London (3-4 AM EST), NY AM (10-11 AM EST — strongest), NY PM (2-3 PM EST). Focus on FVG + Liquidity Sweep during these windows. Align this on synthetics.
   - STRICT FILTERING (Critical):
     - ONLY give signals with 4+ strong confluences.
     - Required: Order Block + Liquidity Void/FVG + Fib level + CRT/Judas Swing/AMD/Silver Bullet confirmation. If any of these core pillars is absent, or if total confluences are fewer than 4, you MUST set "tradeSetup.type" to "WAIT" and explain: "Insufficient confluence — stand aside and wait." in "tradeSetup.rationale".
     - Prefer Buy Limit entries at strong zones. Do not suggest market entries unless clear displacement.
     - First evaluate image quality for all three charts (30M, 4H, 1D). Set imageQuality.status to "failed" if any chart is blurry, cluttered, or lacks scale readability.
     - Suggest live confirmation on TradingView for synthetic symbols (e.g. DERIV:VOLATILITY75, DERIV:VOLATILITY100).
     - Be extremely precise, conservative, and educational. Quality over quantity. If confluences are insufficient, explain: "Insufficient confluence — stand aside and wait." in tradeSetup.rationale.

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

5. PRECISION SETUP OUTPUT (Must Follow):
   Structure your detailed technical fields (detailedVisualDescription, htfBias1D, intermediateStructure4H, entryPrecision30M, and tradeSetup.rationale) to integrate and cover this exact sequence:
   1. Image Quality Assessment (30M / 4H / 1D)
   2. 1D Higher Timeframe Bias
   3. 4H Structure & Key Confluences
   4. 30M Entry Precision (Buy Limit preferred)
   5. Overall Confluence Score + Final Recommendation (referencing past similar trades if available)
   6. Risk Warning: Max 1% risk per trade. This is educational only.

6. Tailor action-focused DOs and DON'Ts specifically to this index (e.g. Volatility 75 wide stop warnings, Crash/Boom spike avoidance rules).
 
You MUST respond strictly with a valid JSON object matching this schema. Do not add any extra explanation text, markdown code-blocks (\`\`\`json) or text before/after the JSON. Just return the raw JSON:
 
{
  "imageQuality": {
    "status": "passed" | "failed",
    "details": "A detailed technical review assessing screenshot clarity, scale-readability, or indicator clutter. Evaluates each timeframe if multiple are received."
  },
  "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "marketStructure": "A brief structural description (e.g. Bullish Break of Structure (BOS) on H1, Liquidity swept, or Bearish CHoCH)",
  "confluenceScore": 3.0,
  "killZone": {
    "status": "ACTIVE_LONDON" | "ACTIVE_NY" | "ACTIVE_NY_PM" | "INACTIVE",
    "windowName": "The human-readable active window name",
    "details": "Checking ICT Kill Zone status for New York time: ${nyTimeStr}. Provide high-priority analysis of whether the current setup aligns with this active zone (${killZoneName})."
  },
  "silverBullet": {
    "status": "ACTIVE_LONDON" | "ACTIVE_NY_AM" | "ACTIVE_NY_PM" | "INACTIVE",
    "windowName": "The human-readable active window name",
    "details": "Checking Silver Bullet status for New York time: ${nyTimeStr}. Provide clear comments on whether FVG validation, Liquidity sweeps, or Order Blocks have confluence with this time-window, particularly for V75 (Order blocks) or Boom/Crash (Spike retests)."
  },
  "candleRangeTheory": {
    "rangeHigh": 1620.00,
    "rangeLow": 1540.00,
    "sweepType": "HIGH_SWEPT" | "LOW_SWEPT" | "NONE",
    "deliveryDirection": "BULLISH" | "BEARISH" | "NEUTRAL",
    "description": "Candle Range Theory (CRT) analysis explaining how HTF candle extremes acted as liquidity boundaries, highlighting any sweeps and delivery direction to opposite end."
  },
  "judasSwing": {
    "detected": true,
    "direction": "BULLISH" | "BEARISH" | "NEUTRAL",
    "triggerLevel": 1622.50,
    "description": "Explains where the Judas Swing false breakout swept liquidity (above rangeHigh or below rangeLow) before reversing and closing inside the range."
  },
  "powerOf3": {
    "detected": true,
    "accumulationRange": "1545.00 - 1558.00",
    "manipulationLevel": 1538.50,
    "distributionTarget": 1595.00,
    "description": "Explains the tight range structure of the Accumulation phase, the false breakout Manipulation sweep (normally confluenced with the Judas Swing), and the subsequent strong Distribution price run toward opposing pools."
  },
  "multiTimeframe": {
    "isMultiTimeframe": true,
    "htfBias1D": "Step-by-step macro bias analysis on the 1D chart, locating primary pools and swing biases.",
    "intermediateStructure4H": "Analysis of intermediate levels and structure alignments on 4H (e.g. Order blocks, FVG zones, shift in character).",
    "entryPrecision30M": "Micro-precision entry zones identification on the 30M chart, refining entry blocks and exact trigger triggers.",
    "confirmationMessage": "Confirmation verification of receiving 30M, 4H, and 1D timeframes for fully systemic top-down mechanical execution."
  },
  "suggestedRisk": "Tailored volatility-adjusted risk. Emphasize 1% max risk, wider stops, or lot size reduction based on indicators.",
  "doActions": [
    "Wait for price to retrace cleanly into the fresh H1 Demand Order Block before launching operations.",
    "Ensure lot size is scaled down 50% to account for V75 high-range variance.",
    "Take 50% off of the table at TP1 and move SL to break-even."
  ],
  "dontActions": [
    "Do NOT chase vertical spikes on Boom/Crash; let price structure rebuild first.",
    "Do NOT widen the red stop-loss level once trade is active.",
    "Do NOT engage if confluence elements drop below 3 structural supports."
  ],
  "detailedVisualDescription": "A technical step-by-step reasoning summary of what your Computer Vision/YOLO scanner detected on the original MT4/MT5 image.",
  "orderBlock": {
    "priceRange": "Detailed price boundary (e.g. 1545.20 - 1560.80 or standard units based on the chart labels)",
    "type": "Type name (e.g., Mitigated H1 Order Block / Fresh Demand Order Block)",
    "rationale": "SMC rationale for why this order block is significant for the entry"
  },
  "supplyDemandZones": {
    "supply": "Supply area or resistance pool (e.g., 1610.00 - 1622.00)",
    "demand": "Demand area or support pool (e.g., 1540.00 - 1555.00)",
    "activeZone": "Supply / Demand / Equilibrium - specifying which one currently controls price"
  },
  "liquidityVoid": {
    "priceRange": "Detailed price boundary of empty imbalance area to show on chart (e.g. 1575.00 - 1595.00)",
    "description": "How the Liquidity Void acts as price magnet because of aggressive imbalance momentum"
  },
  "vacuumBlock": {
    "priceRange": "Detailed price boundary of extreme spikes (e.g. 1515.00 - 1530.00)",
    "description": "The exact return risk representation of extreme vertical gap vacuum blocks"
  },
  "candlestickPatterns": {
    "patternName": "Detected patterns near POIs (e.g., Bullish Engulfing / Hammer / Morning Star / Bearish Shooting Star / Pin Bar)",
    "context": "Contextual mechanical analysis of this pattern near the SMC zones"
  },
  "fibonacciRetracement": {
    "level_50": 0.50,
    "level_618": 0.618,
    "level_786": 0.786,
    "description": "How the fibonacci levels align with the SMC or structural zones identified (e.g., Golden pocket overlaps 4H Demand OB)"
  },
  "tradeSetup": {
    "type": "BUY" | "SELL" | "WAIT",
    "entry": 1560.50,
    "stopLoss": 1538.00,
    "takeProfits": [1590.00, 1610.00, 1635.00],
    "riskRewardRatio": "1:3.2",
    "rationale": "High probability trigger events (e.g., Retracement to Demand zone, liquidity sweep confirmation)"
  },
  "educationalInsight": "A high-value lesson about this synthetic index behavior, spikes, or typical SMC pitfalls to avoid."
}`;

    const textPart = {
      text: `Analyze the provided chart screenshot(s) for ${symbol} indices under the ${timeframe} timeframe (or multiple top-down timeframes if provided, focusing annotation data on the 30M chart structure) according to Smart Money Concepts (SMC), Supply and Demand, and Fibonacci retracement mechanics. Estimate logical numerical index parameters for the entry, stop-loss, and take-profit targets based on the charts' visible numbers/ranges. If no numbers are available, invent logical relative figures starting around 1000.0 or 10000.0. Only offer a BUY/SELL signal if we have 4+ confluences, otherwise set to WAITING.`,
    };

    const response = await generateGeminiContent(ai, "gemini-3.5-flash", {
      model: "gemini-3.5-flash",
      contents: {
        parts: [...contentParts, textPart]
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

    // Safely parse the parsed output
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText.trim());
    } catch {
      // Fallback parser if there is any markdown wrapping
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      parsedResult = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error("Gemini Analysis Server Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An error occurred during AI analysis. Ensure the Gemini API key is valid."
    });
  }
});

// AI Chat Bot endpoint with context awareness
app.post("/api/chat-bot", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { prompt, history, currentAnalysis, tradeHistory, learnings, educationalMode, chartImage, activeSymbol } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "No prompt message provided." });
      return;
    }

    const ai = getGeminiClient();

    // Prepare systemic constraints and inject collections data
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

    // Inject past analysis contexts if active of index configurations
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

    // "Learn from me" Mode: Inject user-specific learnings
    if (learnings && learnings.length > 0) {
      companionDirective += `
USER-SAVED LEARNINGS HISTORY ("Learn from me" database integration):
You MUST remember and reference these previous lessons, notes, or tips that the user has recorded whenever they relate to their query:
${learnings.map((l: any, i: number) => `- [Learning #${i + 1}]: ${l.learnings || l} (Category: ${l.category || "General"})`).join("\n")}
Acknowledge these learnings warmly to show you are aligned with their cumulative experience.
`;
    }

    // Inject user's historical performance logs
    if (tradeHistory && tradeHistory.length > 0) {
      // Compute simple stats
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

    // Format chat contents
    const contents: any[] = [];
    
    // Mount past history if available
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.parts?.[0]?.text || h.message || "" }]
        });
      });
    }

    // Build parts for the current message
    const currentParts: any[] = [];

    // Attach chart image if loaded
    if (chartImage) {
      let base64Data = chartImage;
      let mimeType = "image/png";
      if (chartImage.startsWith("data:")) {
        const match = chartImage.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }
      currentParts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }

    currentParts.push({ text: prompt });
    contents.push({ role: "user", parts: currentParts });

    const response = await generateGeminiContent(ai, "gemini-3.5-flash", {
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction: companionDirective,
        temperature: 0.7,
      }
    });

    res.json({
      success: true,
      data: response.text || "I was unable to formulate a response at this time."
    });

  } catch (error: any) {
    console.error("Chat Bot API error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process chat conversation."
    });
  }
});

// Premium SVG / AI Generated Educational Image Route
app.post("/api/generate-educational-image", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { subject, explanation } = req.body;

    if (!subject) {
      res.status(400).json({ error: "Missing educational diagram subject requested." });
      return;
    }

    const ai = getGeminiClient();

    // Ask Gemini text model to render a beautifully styled trade illustration SVG.
    // This allows custom, fully labeled charts without standard imagen quota blocks!
    const svgSystemPrompt = `You are an elite diagram designer.
Produce a fully complete, self-contained, valid, clean raw SVG file (width 800, height 500) representing high-probability Smart Money trading concepts.
Ensure the layout is responsive, beautiful, dark cyberstyled (slate-950 background, gridlines, bright green wicks, glowing cyan Order Block indicators, and clean rose stop-loss targets).

Your output MUST be exclusively the raw SVG code starting with "<svg" and ending with "</svg>".
Do NOT write markdown code blocks (\`\`\`xml or \`\`\`svg) in the output. Just return the clean raw SVG content.`;

    const svgPromptText = `Generate a high-impact visual SVG layout for: ${subject}. 
Context: ${explanation || "Detailed SMC guide"}.
Use nice SVG tags, text boxes, and charts. Make it extremely visual and beautiful.`;

    const response = await generateGeminiContent(ai, "gemini-3.5-flash", {
      model: "gemini-3.5-flash",
      contents: svgPromptText,
      config: {
        systemInstruction: svgSystemPrompt,
        temperature: 0.3,
      }
    });

    let rawSvg = response.text?.trim() || "";
    
    // Clean up markdown block leaks if any
    if (rawSvg.startsWith("```")) {
      rawSvg = rawSvg.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
    }

    if (!rawSvg.startsWith("<svg")) {
      // Absolute fallback if text model didn't return standard SVG
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

    // Convert to Base64 format
    const base64Svg = Buffer.from(rawSvg).toString("base64");
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

    res.json({
      success: true,
      imageUrl: dataUrl,
      svg: rawSvg
    });

  } catch (error: any) {
    console.error("Diagram Builder Exception:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to compile schematic illustration."
    });
  }
});

// GitHub Auto-Sync API Endpoint
app.post("/api/github-sync", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { token, owner, repo, branch, commitMessage } = req.body;

    const githubToken = token || process.env.GITHUB_TOKEN;
    const githubOwner = owner || process.env.GITHUB_OWNER;
    const githubRepo = repo || process.env.GITHUB_REPO;

    if (!githubToken || !githubOwner || !githubRepo) {
      res.status(400).json({
        success: false,
        error: "Missing GitHub credentials. Please provide GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in the request body or environment variables."
      });
      return;
    }

    const result = await syncProjectToGitHub({
      token: githubToken,
      owner: githubOwner,
      repo: githubRepo,
      branch: branch || "main",
      commitMessage: commitMessage || "feat: automatic push of AI trading workstation to GitHub repository",
    });

    res.json(result);
  } catch (error: any) {
    console.error("GitHub Sync API Exception:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to push files to GitHub repository."
    });
  }
});

// ----------------------------------------------------
// VITE OR STATIC SERVING INTEGRATION
// ----------------------------------------------------

async function mountFrontend() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Synthetics Analyzer] Service up and running in ${process.env.NODE_ENV || "development"} mode at: http://localhost:${PORT}`);
  });
}

mountFrontend();
