# Strategy Audit and Mastermind Roadmap

Scope: every analysis strategy currently used by Noroya-Ai, what each one really does, where it is weak, and a prioritised plan to make the engine genuinely mastermind-grade. Written from a full read of server.ts, api/analyze-chart.ts, api/chat-bot.ts, src/data/symbols.ts and src/components/PineScriptGenerator.tsx.

## 1. Inventory of strategy layers

| Layer | File | What it actually is |
| --- | --- | --- |
| Chart vision analysis | api/analyze-chart.ts and a near-duplicate in server.ts | One large system prompt that tells Gemini to read uploaded screenshots and return a fixed JSON plan |
| Mentor chat | api/chat-bot.ts and a near-duplicate in server.ts | A persona prompt (institutional SMC mentor) with injected context: current analysis, learnings, trade history |
| Asset playbooks | src/data/symbols.ts | Per-asset prose descriptions (forex, gold, crypto, synthetics, indices) plus lot/point metadata |
| Pine scripts | src/components/PineScriptGenerator.tsx | Three TradingView scripts: SMC core, Boom/Crash spike retest, SMC + CRT + Silver Bullet confluence |
| Risk tooling | RiskCalculator.tsx, PnlGrowthChart.tsx, TradeSettlementForm.tsx | Position sizing, equity curve, trade settlement |
| Data model | firebase-blueprint.json, firestore.rules | Trade, ChatHistory, UserLearning entities |

## 2. The concept set the prompts encode

- Market structure: BOS, CHoCH, market structure shift, mitigation and unmitigated blocks.
- Order flow: order blocks, breaker blocks, fair value gaps (FVG), liquidity voids, vacuum blocks, supply and demand, premium vs discount (50 percent rule), optimal trade entry 0.618 to 0.786.
- Time: ICT killzones (London, NY AM, NY PM), Silver Bullet windows, Judas swing, Candle Range Theory, Power of 3 / AMD, Asian range sweep.
- Cross-asset: SMT divergence (correlated and inversely correlated pairs), round psychological numbers.
- Risk: anti stop-loss structural placement with per-asset buffers, 1:2.5 to 1:3 minimum R:R, partials at TP1 and break-even stop.
- Crypto-specific (in the BTC section): CME gap fills, weekend range engineering, Monday weekly open Power of 3, funding-rate liquidation cascades.

## 3. Findings (what holds it back)

1. It is prompt-only, not an engine (severity: high). There are no deterministic rules. The model both detects structures and grades its own confidence, so results are subjective, non-reproducible and impossible to unit test.
2. Two sources of truth (high). The analyze-chart and chat-bot logic exists twice: in server.ts (local dev) and in api/*.ts (Vercel). They already differ in model lists, temperatures and prompt wording, so they will drift.
3. Confluence is self-reported (high). The prompt asks for 4+ confluences but nothing verifies the count. A hallucinated confluence reads identically to a real one.
4. Invented probability (high). The prompt tells the model to maintain a mental win probability, but it has no ground-truth statistics - the number is fabricated and could mislead a trader.
5. No economic-calendar awareness (high). The prompt forbids trading around CPI/NFP/FOMC, but the model cannot know release times. The rule is unenforceable as written.
6. Session logic is FX-centric (medium). Killzones, Judas swings and Silver Bullet windows are applied to 24/7 synthetics and crypto where the FX session model only partially applies.
7. No live macro or derivatives data (medium). No funding rate, open interest, dominance or ETF/news feed is actually fetched; the model only reasons about the pasted screenshot.
8. Output is not validated (medium). JSON is parsed with a try/catch and a naive backtick strip. A malformed response throws a 500 instead of being repaired.
9. Context injected as raw text (medium). Learnings and trade history are concatenated into the prompt as free text, which invites prompt injection from stored notes and gives no relevance ranking.
10. Security and cost surface (high). CORS is wide open, a client-supplied Gemini key path exists, there is no rate limiting, and base64 images up to 25 MB are accepted - an abuse and billing risk.
11. No caching (low). Every upload re-runs a full vision call.
12. No automated tests (medium). Nothing guards the prompt, parsing or risk maths.

## 4. Mastermind roadmap

### P0 - correctness and trust

1. One source of truth: move the prompts into shared modules (for example src/prompts/analyze.ts, src/prompts/chat.ts) and import them from both server.ts and the api functions. This ends the drift between the two copies.
2. Deterministic confluence engine: detect structures in code from price data (swing highs/lows, BOS/CHoCH, FVG by displacement, premium/discount of the dealing range) and compute the confluence score in code. Let the model narrate, not score.
3. Schema validation and repair: validate the model JSON against a schema (zod or a hand-written guard) and retry once with a repair instruction on failure, instead of throwing.
4. Real session and calendar service: a small server function that returns the active killzone and the next high-impact events from a free calendar. Pass the result into the prompt so news blackout and session rules become enforceable.
5. Live data first: never let the model invent price. You already pass currentPrice for synthetics; the crypto desk now adds /api/crypto-market. Extend the same pattern to every asset class.
6. Harden the API: rate limit per IP, cap image size, and gate or remove the client-supplied key path. Prefer server-only GEMINI_API_KEY.

### P1 - intelligence

7. Grounded probability from the user's own journal: compute win rate and expectancy per pattern/session/asset from logged trades and inject those real numbers instead of asking the model to guess.
8. Retrieval over learnings: embed stored notes and retrieve the top-k relevant ones per query, and sanitise them so they cannot hijack the prompt.
9. Multi-timeframe alignment score: score 1D/4H/30M bias agreement in code and surface it separately from the model narrative.
10. Trade analytics: expectancy, average R, MAE/MFE, best/worst session, so the mentor can give evidence-based feedback.
11. Alerting: a webhook or Telegram ping when a fresh, high-confluence setup is detected.

### P2 - edge

12. Crypto derivatives context: funding rate, open interest and liquidation heatmaps via a public API, injected as structured data.
13. On-chain and flow proxies: exchange netflow, CVD, stablecoin supply as regime filters.
14. Optional execution or paper-trading integration for the confirmed setups.
15. Prompt versioning and A/B telemetry so prompt changes are measured, not guessed.

## 5. Asset and session matrix (correction needed)

| Asset class | Session model | News blackout | Extra filters to add |
| --- | --- | --- | --- |
| Forex majors and crosses | Full FX killzones and Judas swing | Yes | SMT vs DXY, session range |
| Gold | London and NY killzones | Yes | Round numbers, real yields |
| Crypto | 24/7: weekly open and weekend range replace the session gaps | Exchange and regulatory events | CME gaps, funding, dominance, OI |
| Synthetics | 24/7 algorithmic, no news | Not applicable | Volatility regime, tick spikes |

The current prompt applies the FX session grid too broadly. The roadmap item 4 plus a per-class session profile fixes this.

## 6. Crypto-specific gaps closed in this change set

- Live market data endpoint and client fallback (new).
- Dedicated crypto analysis endpoint with a 24/7 playbook (new).
- A crypto coverage universe across Majors, Layer 1, Layer 2, DeFi and Meme (new).

## 7. Remaining crypto work

- Feed funding rate, open interest and dominance from a real source (P2 item 12).
- Persist crypto trades to Firestore so they join the existing journal and analytics.
- Move the crypto desk into the main navigation once App.tsx can be edited safely with a build available.
