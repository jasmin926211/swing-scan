# Kronos dashboard

Next.js 16 UI for the [Kronos backend](https://github.com/jasmin926211/kronos-backend):

- `/` — live India (Nifty 500) or USA (S&P 500) prices and indices; country picked in the header.
  Search, sector filter, sort, top gainers / losers / most active. Refreshes every 15 s while the market is open.
- `/stock/{in|us}/{SYMBOL}` — live quote, Highcharts candlestick + volume chart (hourly / daily / weekly),
  an on-demand Kronos forecast drawn on the chart (median, 50% and 80% bands, sampled paths), and a
  recent-accuracy check of Kronos on that stock.

```bash
npm install
npm run dev        # http://localhost:3000, expects the backend on :8000
```

`BACKEND_URL` overrides the backend address (default `http://127.0.0.1:8000`); `/api/*` is proxied to it.

Highcharts is free for personal and non-commercial use; commercial use needs a Highcharts licence.
