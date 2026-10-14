# Noroya-Ai - Design System and Feature Spec

This document is the source of truth for UI decisions in this project. It was reverse-engineered from the existing codebase (src/index.css and the components) and extended with the new Crypto Trading Workstation. Correct anything that does not match intent before further UI work.

## 1. Product

- Name: Synthetic SMC Analytica (repo Noroya-Ai).
- Purpose: AI chart analysis for synthetic indices, forex, metals and crypto using Smart Money Concepts (SMC) and ICT, plus risk tools and trade journaling.
- Audience: retail-to-intermediate traders who understand basic candlesticks and want institutional order-flow framing.
- Tone: disciplined and institutional, capital-preservation first, educational, never promising profit.

## 2. Visual language (from src/index.css)

- Theme: light, ultra-clean, cyber-industrial.
- Background: #f8fafc. Foreground: #0f172a. Cards: white with border-slate-200, rounded-2xl, shadow-2xl.
- Dark surfaces (code, terminals, charts): #020617.
- Accents: the main app uses a violet to indigo to cyan gradient. The crypto desk uses amber to orange to cyan.
- Utilities available: glow-green, glow-red, glow-cyan, animate-scan.

## 3. Typography

- Body: Plus Jakarta Sans.
- Headings: Space Grotesk (class font-display).
- Numbers, prices, code: JetBrains Mono (class font-mono).
- Micro-labels: 10px, uppercase, tracking-wider, font-mono, slate-400 or slate-500.

## 4. Spacing and shape

- Radius: rounded-2xl for cards, rounded-xl for inner panels, rounded-lg for inputs and small buttons.
- Card padding: p-5. Section gaps: gap-6.
- Primary layout grid: grid-cols-1 lg:grid-cols-3 for a two-thirds content column and a one-third side column.

## 5. Component conventions

- Buttons: primary is a solid accent with dark text and bold uppercase; secondary is white with border-slate-200.
- Inputs: rounded-lg, border-slate-200, font-mono, focus ring via focus:border-amber-400 (crypto) or the section accent.
- Badges: small rounded-full pills, uppercase, colored border and text.
- States: every data panel must handle loading, empty and error states explicitly.

## 6. Crypto Trading Workstation (new)

- Route: /#crypto (hash), rendered instead of the main app. It is isolated so it cannot regress the existing screens.
- Flow: select asset, view live price and candles, run the AI crypto SMC analysis, review the plan, then size the position.
- Data: /api/crypto-market (ticker and klines) with a client fallback to Binance then Coinbase.
- Analysis: /api/analyze-crypto, a crypto-specialised SMC/ICT playbook returning strict JSON.
- Coverage: Majors, Layer 1, Layer 2, DeFi, Meme.

## 7. Copy voice

- Direct, mechanical, risk-first. Example: Require a minimum 1:2.5 risk to reward. Always end analysis output with an educational-only disclaimer.

## 8. Open questions

- Should the crypto desk live inside the main app navigation instead of a separate hash route? Wiring is deferred because the sandbox was unavailable to safely edit the very large App.tsx.
- Should crypto trades persist to Firestore alongside the existing trade journal, instead of component-local state?
