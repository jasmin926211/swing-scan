# CandleTrade

Next.js 16 frontend for the CandleTrade backend.

- `/` — public home page: hero, live market snapshot (indices, largest stocks, movers), features,
  trading habits, accuracy & reliability, supported markets.
- `/signin`, `/signup` — accounts. Everything below needs a signed-in user (`src/proxy.ts`).

- `/markets` — every Indian (NSE + BSE, ~5,000) or US (NYSE + Nasdaq + AMEX, ~6,000) stock with live prices and
  indices; country picked in the header. Search, exchange / sector / F&O filters, sorting, top gainers / losers /
  most active, paging. Refreshes every 15 s while the market is open.
- `/stock/{in|us}/{SYMBOL}` — live quote, D3 candlestick + volume chart (hourly / daily / weekly),
  an on-demand AI forecast drawn on the chart (median, 50% and 80% bands, sampled paths), and a
  recent-accuracy check of the AI on that stock.
- `/fno` and `/fno/{in|us}/{SYMBOL}` — futures & options analysis (no orders): futures (India), option chain
  with OI chart, IV, delta, PCR and max pain, and AI trade ideas valued on the AI's paths and on the
  market's implied volatility side by side. Indian F&O prices need a daily "Connect Upstox" (admin key).

```bash
npm install
npm run dev        # http://localhost:3000, expects the backend on :8000
```

`BACKEND_URL` overrides the backend address (default `http://127.0.0.1:8000`); `/api/*` is proxied to it.

Charts are drawn with D3 (ISC licence).
