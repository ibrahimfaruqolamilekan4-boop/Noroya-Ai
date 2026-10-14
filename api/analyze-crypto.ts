// Crypto-specialised AI analyzer (Vercel serverless function).
// Applies a deep SMC/ICT crypto playbook: CME gaps, funding rates, liquidation
// cascades, BTC dominance, alt rotation and 24/7 session structure. Returns strict JSON.

import { GoogleGenAI } from '@google/genai';

function getGeminiClient(customKey?: string): GoogleGenAI {
  const key = customKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured. Add it in your Vercel project environment variables, or paste a Gemini API key in the Control tab.');
  }
  return new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'noroya-crypto' } } });
}

async function generateWithFallback(ai: GoogleGenAI, preferred: string, params: any): Promise<any> {
  const models = Array.from(new Set([preferred, 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite']));
  let lastError: any = null;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await ai.models.generateContent(Object.assign({}, params, { model }));
      } catch (error: any) {
        lastError = error;
        const detail = String((error && error.message) || (error && error.status) || '').toLowerCase();
        const status = error && error.status;
        const fatal = detail.indexOf('api_key_invalid') >= 0 || detail.indexOf('api key not valid') >= 0 || detail.indexOf('unauthorized') >= 0 || status === 400 || status === 401 || status === 403;
        if (fatal || attempt >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 700));
      }
    }
  }
  throw lastError;
}

const CRYPTO_SCHEMA = {
  imageQuality: { status: 'passed or failed', details: 'screenshot clarity and scale readability review' },
  bias: 'BULLISH | BEARISH | NEUTRAL',
  marketStructure: 'BOS or CHoCH description with mitigation state',
  dominanceContext: 'BTC dominance read and its implication for this asset',
  fundingRateContext: 'funding direction, crowded side and expected liquidation magnet',
  cmeGap: { present: false, gapRange: 'low to high', fillProbability: 'percent', description: 'gap fill rationale' },
  liquidationContext: 'nearest liquidation cluster and the resulting liquidity magnet',
  confluenceScore: 4.5,
  antiStopLossShield: { structuralInvalidationPrice: 0, bufferPercentApplied: 0, protectionRationale: 'why the stop sits beyond the displacement origin' },
  sessionContext: 'Asia, London or New York session read and active manipulation window',
  tradeSetup: { type: 'BUY | SELL | WAIT', entry: 0, stopLoss: 0, takeProfits: [0, 0], riskRewardRatio: '1:3', rationale: 'why this setup is valid' },
  doActions: ['actionable confirmation step'],
  dontActions: ['risk warning to avoid'],
  detailedVisualDescription: 'step by step of what the scanner detected',
  educationalInsight: 'one high value lesson specific to this asset',
};

function buildSystemPrompt(educationalMode: boolean): string {
  const base = `You are an elite 24/7 crypto Smart Money Concepts (SMC) and ICT mentor and Chief Risk Officer.
Analyse the provided crypto market context for the requested asset and timeframe and output an executable plan.

CRYPTO INSTITUTIONAL PLAYBOOK:
1. CME GAP THEORY: Bitcoin and Ethereum futures gaps between the Friday 17:00 EST close and the Sunday 18:00 EST open act as magnets. Assume a high probability of rebalance during the first 48 hours of the new week and prefer entries that target the gap edge.
2. FUNDING RATE AND LIQUIDATION CASCADES: when funding is extreme the crowded side becomes liquidity. Expect engineered sweeps through equal highs or equal lows that trigger cascading liquidations before the true expansion. Trade the reversion into the unmitigated order block after the cascade.
3. WEEKEND AND 24/7 STRUCTURE: crypto never closes, so the weekly open and the weekend range replace the session gaps of FX. The Monday weekly open high and low plus the weekend range extremes are the primary liquidity pools.
4. SESSION WINDOWS: even in a 24/7 market respect microstructure - Asia builds the range, London sweeps it during the Judas window and New York delivers the daily expansion. Avoid new entries during thin weekend hours unless you are playing a documented sweep.
5. PREMIUM AND DISCOUNT: never buy in premium and never sell in discount of the dealing range. Target the 0.618 to 0.786 OTE zone and place the stop beyond the displacement origin plus a volatility buffer wide enough for crypto wick behaviour.
6. DOMINANCE AND ROTATION: read BTC dominance and the BTC to ETH ratio as an SMT filter. When dominance rises, high-beta altcoins should be short-biased; when it falls, rotation favours alts.
7. NEWS AND LISTINGS: regulatory headlines, ETF decisions and exchange events create violent displacement. Never enter the first impulse candle; wait for the FVG retest.
8. RISK: require a minimum 1:2.5 risk to reward, take partial profits at the first external liquidity pool, move the stop to break even and cap risk at 1 percent of the account.

RULES:
- Only issue a BUY or SELL when there are four or more stacked confluences (order block, liquidity void or FVG, Fibonacci level, plus a CRT, Judas swing, AMD or liquidity sweep confirmation). Otherwise set tradeSetup.type to WAIT and explain why in tradeSetup.rationale.
- Explain mechanics precisely and never guarantee outcomes. End every response with a one line risk disclaimer noting this is educational only and not financial advice.
- Respond with a single valid JSON object that matches this schema exactly and nothing else:
`;
  const instruction = educationalMode
    ? 'EDUCATIONAL MODE: teach each concept step by step and optionally quiz the user.'
    : 'TACTICAL MODE: be concise and give exact entry, stop and target levels.';
  return base + JSON.stringify(CRYPTO_SCHEMA) + '\n' + instruction;
}

function buildUserPrompt(input: any): string {
  const lines: string[] = [];
  lines.push('Asset: ' + (input.ticker || input.symbol));
  lines.push('Timeframe: ' + (input.timeframe || '1h'));
  if (input.currentPrice) lines.push('Live price at scan time: ' + input.currentPrice);
  const candles: any[] = Array.isArray(input.candles) ? input.candles : [];
  if (candles.length > 0) {
    const closes = candles.map((candle) => candle.close);
    const highs = candles.map((candle) => candle.high);
    const lows = candles.map((candle) => candle.low);
    const recent = closes.slice(-12).map((value) => Number(value).toFixed(4)).join(', ');
    lines.push('Recent closes (oldest to newest): ' + recent);
    lines.push('Range high: ' + Math.max.apply(null, highs).toFixed(4));
    lines.push('Range low: ' + Math.min.apply(null, lows).toFixed(4));
    const first = closes[0];
    const last = closes[closes.length - 1];
    const change = first > 0 ? (((last - first) / first) * 100).toFixed(2) : '0';
    lines.push('Change over the window: ' + change + ' percent');
  }
  if (input.learnings && Array.isArray(input.learnings) && input.learnings.length > 0) {
    lines.push('User saved learnings:');
    input.learnings.slice(0, 10).forEach((item: any) => {
      lines.push('  - ' + (item.learnings || item) + (item.category ? ' (' + item.category + ')' : ''));
    });
  }
  if (input.tradeHistory && Array.isArray(input.tradeHistory) && input.tradeHistory.length > 0) {
    const won = input.tradeHistory.filter((trade: any) => trade.status === 'WON').length;
    const total = input.tradeHistory.length;
    lines.push('Historical performance: ' + total + ' trades, win rate ' + Math.round((won / total) * 100) + ' percent.');
  }
  lines.push('Deliver the crypto SMC plan as strict JSON.');
  return lines.join('\n');
}

export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const body = req.body || {};
    if (!body.symbol) {
      res.status(400).json({ success: false, error: 'Missing crypto symbol.' });
      return;
    }

    const customKey = req.headers['x-gemini-key'] || body.geminiApiKey;
    const ai = getGeminiClient(customKey);

    const parts: any[] = [];
    if (body.image && typeof body.image === 'string' && body.image.length > 50) {
      let data = body.image.replace(/\s+/g, '');
      let mimeType = 'image/png';
      if (body.image.indexOf('data:') === 0) {
        const split = body.image.split(';base64,');
        if (split.length === 2) {
          mimeType = split[0].replace('data:', '');
          data = split[1].replace(/\s+/g, '');
        }
      }
      parts.push({ inlineData: { mimeType, data } });
    }
    parts.push({ text: buildUserPrompt(body) });

    const response = await generateWithFallback(ai, 'gemini-3.8-flash', {
      contents: { parts },
      config: {
        systemInstruction: buildSystemPrompt(Boolean(body.educationalMode)),
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = (response && response.text) || '';
    if (!text) throw new Error('No response returned from the model endpoint.');

    let parsed: any;
    try {
      parsed = JSON.parse(text.trim());
    } catch (parseError) {
      parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    }

    res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: (error && error.message) || 'Crypto analysis failed. Ensure the Gemini API key is valid.' });
  }
}
