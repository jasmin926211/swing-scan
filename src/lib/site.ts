// Published accuracy figures for the home page. Source: walk-forward test in the backend README
// ("How accurate is it?"): balanced model, 64-bar lookback, daily bars, 10 trading days ahead,
// 12 non-overlapping checks on each of 10 large US and Indian stocks (120 forecasts, Oct 2026).
// Update these together with that README when a new test is run.
export const ACCURACY = {
  forecasts: 120,
  stocks: 10,
  horizonDays: 10,
  testedOn: "October 2026",
  directionRight: 0.617,
  avgError: 0.042,
  noChangeError: 0.039,
  rawBandCoverage: 0.41,
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
