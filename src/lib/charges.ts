import type { MarketId } from "@/lib/api";

/** Fees and taxes on one round trip (buy + sell), per leg, as brokers charge them.
 *
 *  India: a discount broker's equity rates (zerodha.com/charges, checked 23 Oct 2026). Brokerage: delivery free,
 *  intraday 0.03% or Rs 20 an order, whichever is lower. STT: delivery 0.1% on buy and sell, intraday 0.025% on the
 *  sell. Exchange: NSE 0.00307%, BSE 0.00375%. SEBI: Rs 10 a crore. Stamp duty on the buy: delivery 0.015%, intraday
 *  0.003%. GST 18% on brokerage + exchange + SEBI. Delivery sells: Rs 15.34 DP charge per stock.
 *  USA: no commission (most US brokers). SEC fee $20.60 per $1M sold (from 4 Apr 2026, sec.gov fee advisory 2026-2);
 *  FINRA trading activity fee $0.000195 a share sold, at most $9.79 a trade (2026 schedule as brokers pass it on).
 *  Not included: slippage (the gap between the price you want and the price you get), and taxes on gains. */
export type TradeKind = "intraday" | "swing";
export type Side = "buy" | "short";
export type Charge = { label: string; amount: number };

export const CHARGES_CHECKED = "23 Oct 2026";

const IN = {
  brokerageIntraday: { rate: 0.0003, cap: 20 },
  stt: { swing: 0.001, intraday: 0.00025 },
  exchange: { NSE: 0.0000307, BSE: 0.0000375 },
  sebi: 10 / 1e7,
  stamp: { swing: 0.00015, intraday: 0.00003 },
  gst: 0.18,
  dp: 15.34,
};
const US = { secPerDollar: 20.6 / 1e6, tafPerShare: 0.000195, tafCap: 9.79 };

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Itemised charges for buying `qty` at `buy` and selling at `sell` (for a short, the sell comes first: same legs). */
export function charges(market: MarketId, kind: TradeKind, qty: number, buy: number, sell: number, exchange: "NSE" | "BSE" = "NSE"): Charge[] {
  const b = qty * buy;
  const s = qty * sell;
  if (qty <= 0) return [];
  if (market === "us") {
    return [
      { label: "SEC fee (on the sale)", amount: r2(s * US.secPerDollar) },
      { label: "FINRA fee (on the sale)", amount: r2(Math.min(US.tafCap, qty * US.tafPerShare)) },
    ];
  }
  const brokerage = kind === "intraday"
    ? Math.min(IN.brokerageIntraday.cap, b * IN.brokerageIntraday.rate) + Math.min(IN.brokerageIntraday.cap, s * IN.brokerageIntraday.rate)
    : 0;
  const stt = Math.round(kind === "intraday" ? s * IN.stt.intraday : (b + s) * IN.stt.swing); // brokers round STT to the rupee
  const exch = (b + s) * IN.exchange[exchange];
  const sebi = (b + s) * IN.sebi;
  const stamp = b * IN.stamp[kind];
  const gst = (brokerage + exch + sebi) * IN.gst;
  const out: Charge[] = [
    { label: "Brokerage", amount: r2(brokerage) },
    { label: "STT", amount: r2(stt) },
    { label: "Exchange charges", amount: r2(exch) },
    { label: "SEBI fee", amount: r2(sebi) },
    { label: "Stamp duty", amount: r2(stamp) },
    { label: "GST", amount: r2(gst) },
  ];
  if (kind === "swing") out.push({ label: "DP charge (on the sale)", amount: IN.dp });
  return out;
}

export const total = (c: Charge[]) => r2(c.reduce((a, x) => a + x.amount, 0));

export type Plan = {
  qty: number;
  perShareRisk: number;
  value: number;
  limitedBy: "risk" | "capital" | null;
  lossAtStop: number;          // money lost if stopped, charges included (positive number)
  chargesAtStop: Charge[];
  profitAtTarget: number | null; // after charges; can be negative when the target is too close
  chargesAtTarget: Charge[] | null;
  reward: number | null;       // profit at target / loss at stop, after charges
  winRateNeeded: number | null; // share of trades that must hit the target to break even
  breakEven: number;           // exit price that just covers the charges
};

/** Size a trade so the loss at the stop, charges included, stays within `maxLoss`, and the position within `capital`. */
export function plan(market: MarketId, kind: TradeKind, side: Side, entry: number, stop: number, target: number | null,
  capital: number, maxLoss: number, exchange: "NSE" | "BSE" = "NSE"): Plan | null {
  const long = side === "buy";
  const perShareRisk = long ? entry - stop : stop - entry;
  if (!(entry > 0) || !(perShareRisk > 0) || !(maxLoss > 0)) return null;
  // Buys: buy at entry, sell at the exit. Shorts: sell at entry, buy back at the exit.
  const legs = (q: number, exit: number) => (long ? charges(market, kind, q, entry, exit, exchange) : charges(market, kind, q, exit, entry, exchange));
  const loss = (q: number) => q * perShareRisk + total(legs(q, stop));
  const byCapital = capital > 0 ? Math.floor(capital / entry) : Infinity;
  let qty = Math.min(Math.floor(maxLoss / perShareRisk), byCapital);
  while (qty > 0 && loss(qty) > maxLoss) qty--;
  const limitedBy = qty <= 0 ? null : qty === byCapital && Math.floor(maxLoss / perShareRisk) > byCapital ? "capital" : "risk";
  const chargesAtStop = legs(qty, stop);
  const lossAtStop = qty * perShareRisk + total(chargesAtStop);
  let chargesAtTarget: Charge[] | null = null;
  let profitAtTarget: number | null = null;
  if (target != null && target > 0 && (long ? target > entry : target < entry) && qty > 0) {
    chargesAtTarget = legs(qty, target);
    profitAtTarget = qty * Math.abs(target - entry) - total(chargesAtTarget);
  }
  const reward = profitAtTarget != null && lossAtStop > 0 ? profitAtTarget / lossAtStop : null;
  const winRateNeeded = profitAtTarget != null && profitAtTarget > 0 ? lossAtStop / (lossAtStop + profitAtTarget) : null;
  // Break-even exit: move until the gain pays the charges at that exit (two passes converge to the paisa / cent).
  const q = Math.max(qty, 1);
  let be = entry;
  for (let i = 0; i < 3; i++) be = entry + (long ? 1 : -1) * (total(legs(q, be)) / q);
  return { qty, perShareRisk, value: qty * entry, limitedBy, lossAtStop, chargesAtStop, profitAtTarget, chargesAtTarget, reward, winRateNeeded, breakEven: be };
}
