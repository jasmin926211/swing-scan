// Published research figures (backend docs/PATTERNS.md). Update together with that file when a test is re-run.
export const TESTED = {
  patternSetups: 430, // signal types tested across 4 styles x 2 markets (section 3)
  patternsPassed: 23, // validated and deployed (section 2)
  momentumEdgeQuarter: 0.0176, // top 20% by momentum rating vs the average liquid stock, next 3 months, India (section 8)
  expectedMoveCoverage: 0.8, // share of moves inside the Expected move's 80% range, held-out check (section 7)
  breakoutTrades: 90273, // breakout buying with a stop and a 2R target: lost money (sections 8c, 8d)
};

export const COVERAGE = {
  in: {
    name: "India",
    exchanges: "NSE + BSE",
    stocks: "5,000+",
    indices: ["Nifty 50", "Sensex", "Bank Nifty", "Nifty 500"],
    fno: "Futures & options on NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, NIFTYNXT50 and 200+ F&O stocks (live via Upstox)",
  },
  us: {
    name: "USA",
    exchanges: "NYSE + Nasdaq + AMEX",
    stocks: "6,000+",
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
