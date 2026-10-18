// Published accuracy figures. Source: walk-forward test in the backend README ("How accurate is it?"):
// fast model (the default), 64-bar lookback, daily bars, 10 trading days ahead, 12 checks on each of
// 36 stocks — 12 Indian F&O, 12 smaller Indian, 12 US — over ~1.2 years (395 forecasts, Oct 2026).
// Update these together with that README when a new test is run.
export const ACCURACY = {
  forecasts: 395,
  stocks: 36,
  horizonDays: 10,
  testedOn: "October 2026",
  directionRight: 0.559,
  shortTermDirection: 0.513, // 1 day ahead
  avgError: 0.067,
  noChangeError: 0.065,
  rawBandCoverage: 0.34,
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
