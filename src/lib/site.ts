// Published research figures (backend docs/PATTERNS.md). Update together with that file when a test is re-run.
export const TESTED = {
  patternsTested: 96, // chart, candlestick, support / resistance and ICT pattern types (sections 3, 22, 23; the Tested patterns page)
  patternsPassed: 10, // of those, passed in at least one timeframe and market (section 2 + section 22's order block)
  setupsPassed: 24, // validated setups behind them: timeframe x market x filters (validated.json + the ICT order block)
  momentumEdgeQuarter: { in: 0.0176, us: 0.017 }, // top 20% by momentum rating vs the average liquid stock, next 3 months (section 8b)
  expectedMoveCoverage: 0.8, // share of moves inside the Expected move's 80% range, held-out check (section 7)
  breakoutTrades: 363851, // breakout buying with a stop and a 2R target, India 90,273 + USA 273,578: lost money (sections 8c, 8d)
};

export const COVERAGE = {
  in: {
    name: "India",
    exchanges: "NSE + BSE",
    stocks: "2,800",
    indices: ["Nifty 50", "Sensex", "Bank Nifty", "Nifty 500"],
    fno: "Futures & options on NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, NIFTYNXT50 and 200+ F&O stocks (live while Upstox is connected)",
  },
  us: {
    name: "USA",
    exchanges: "NYSE + Nasdaq + AMEX",
    stocks: "3,800",
    indices: ["S&P 500", "Nasdaq", "Dow Jones", "Russell 2000"],
    fno: "Options on listed US stocks (single-stock futures don’t trade in the US)",
  },
} as const;

// Shown on the Contact page and in the footer.
export const CONTACT = {
  email: "jjt926211@gmail.com",
  phone: "+61494047868",
  phoneDisplay: "+61 494 047 868",
};
