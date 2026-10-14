# Crypto Trading Feature

A self-contained crypto trading vertical slice added on top of Noroya-Ai. It does not modify the existing analysis engine, so it cannot regress the current screens.

## What was added

| File | Purpose |
| --- | --- |
| src/lib/cryptoMarket.ts | Crypto asset catalog (14 assets across 5 categories), formatting helpers, position-size maths, and data loaders |
| api/crypto-market.ts | Serverless live market data: ticker and klines, Binance primary with Coinbase fallback |
| api/analyze-crypto.ts | Crypto-specialised Gemini analyzer returning strict JSON (CME gaps, funding, dominance, session, setup) |
| src/components/CryptoWorkstation.tsx | The crypto UI: live watchlist, SVG candle chart, AI analysis report, position sizing |
| src/main.tsx | Tiny hash route: renders the workstation at /#crypto, otherwise the normal app |

## How it works

1. The workstation loads prices for all covered assets from /api/crypto-market?action=ticker.
2. Selecting an asset loads candles from /api/crypto-market?action=klines for the chosen timeframe.
3. Run Crypto SMC Analysis posts the symbol, timeframe, live price and recent candles to /api/analyze-crypto.
4. The analyzer returns strict JSON which is rendered as a plan, and the trade levels auto-fill the position sizer.
5. Position sizing converts account size and risk percent into units, notional and reward ratio.

## How to use it

- Deployed (Vercel): open the site and go to the /#crypto hash route, for example https://your-app.vercel.app/#crypto.
- Everything else (main app) continues to render exactly as before.

## Data providers

- Primary: Binance public REST (api.binance.com), no API key required.
- Fallback: Coinbase Exchange public REST (api.exchange.coinbase.com), used automatically where Binance is geo-restricted.
- The client also falls back to calling these providers directly if the serverless endpoint is unreachable, so the desk still works in local dev.

## Local development note

Local dev runs `tsx server.ts`, which only serves the endpoints defined in server.ts. The new files under api/ are Vercel functions and are not mounted by that Express server, so:

- The market-data desk still works locally because of the direct-provider fallback in src/lib/cryptoMarket.ts.
- The AI analysis button needs either a Vercel deployment or a manual route registration in server.ts (see wiring below).

## Wiring into the main navigation (deferred)

The crypto desk currently lives behind the /#crypto hash so we did not have to edit src/App.tsx (about 160 KB) blind. To promote it into the main app when a build is available:

1. Import the component: `import CryptoWorkstation from './components/CryptoWorkstation';`
2. Add a top-level tab or nav item and render `CryptoWorkstation` from it, passing the active symbol if you want to reuse the existing selector.
3. Optionally register the two endpoints in server.ts for local parity: add GET /api/crypto-market (ticker and klines) and POST /api/analyze-crypto that call the same provider and Gemini logic.
4. Remove the hash branch in src/main.tsx once the tab exists.

## Configuration

- Reuses GEMINI_API_KEY (server) or the x-gemini-key header (client Control tab). No new secrets required.
- No new npm dependencies were added.

## Extending

- Add an asset: append an entry to CRYPTO_ASSETS in src/lib/cryptoMarket.ts. Any USDT pair works; the Coinbase fallback maps it to BASE-USD automatically.
- Persist trades: replace the local position-sizer state with writes to the existing Firestore trades collection so crypto joins the main journal.
- Add indicators: the chart is a hand-rolled SVG renderer, so overlays (order blocks, FVG boxes, entry/SL/TP lines) can be drawn as extra SVG elements without a chart library.

## Limitations and next steps

- The candle chart is a lightweight view, not a full charting terminal. Use the tvSymbol value for detailed TradingView confirmation.
- Funding rate, open interest and dominance are reasoned about by the model from context; wiring a live derivatives feed is the next step for true crypto edge.
- Crypto trades are not yet saved to the journal.
- The UI was not visually audited in this change because no sandbox or browser was available; review it in a real browser before promoting it into the main navigation.
