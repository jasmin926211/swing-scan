// Illustrative candlestick chart with a Kronos-style forecast fan (decorative, not real data).

const UP = "#1baf7a";
const DOWN = "#e34948";
const KRONOS = "#2a78d6";

// Deterministic walk so the art is the same on every render.
const CANDLES = (() => {
  const out: { o: number; c: number; h: number; l: number }[] = [];
  let price = 150;
  const moves = [4, -3, 5, 2, -6, -2, 3, 6, -1, 4, -5, 2, 7, -3, 4, 3, -4, 5, -2, 6, 2, -3, 5, 4];
  for (const m of moves) {
    const o = price;
    const c = price + m;
    out.push({ o, c, h: Math.max(o, c) + 2 + (Math.abs(m) % 3), l: Math.min(o, c) - 2 - (m % 2 === 0 ? 1 : 2) });
    price = c;
  }
  return out;
})();

const W = 560;
const H = 320;
const PAD = 24;
const STEP = 16;
const FORECAST_STEPS = 8;
const last = CANDLES[CANDLES.length - 1].c;
const fan = Array.from({ length: FORECAST_STEPS }, (_, i) => {
  const t = i + 1;
  const mid = last + 1.6 * t;
  return { mid, lo80: mid - 2.6 * Math.sqrt(t) * 1.6, hi80: mid + 2.6 * Math.sqrt(t) * 1.6, lo50: mid - 1.3 * Math.sqrt(t) * 1.6, hi50: mid + 1.3 * Math.sqrt(t) * 1.6 };
});
const all = [...CANDLES.flatMap((c) => [c.h, c.l]), ...fan.flatMap((f) => [f.lo80, f.hi80])];
const MIN = Math.min(...all) - 4;
const MAX = Math.max(...all) + 4;
const y = (v: number) => PAD + ((MAX - v) / (MAX - MIN)) * (H - 2 * PAD);
const x = (i: number) => PAD + i * STEP + STEP / 2;
const nowX = x(CANDLES.length - 1);

function band(lo: (f: (typeof fan)[number]) => number, hi: (f: (typeof fan)[number]) => number) {
  const top = fan.map((f, i) => `${x(CANDLES.length + i)},${y(hi(f))}`);
  const bottom = fan.map((f, i) => `${x(CANDLES.length + i)},${y(lo(f))}`).reverse();
  return [`${nowX},${y(last)}`, ...top, ...bottom].join(" ");
}

export function HeroArt() {
  return (
    <div className="relative rounded-2xl border border-line bg-white p-3 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Illustration: candlestick chart with a forecast range">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={PAD + f * (H - 2 * PAD)} y2={PAD + f * (H - 2 * PAD)} stroke="#ebebe8" />
        ))}
        {CANDLES.map((c, i) => {
          const color = c.c >= c.o ? UP : DOWN;
          return (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth={1.2} />
              <rect x={x(i) - 4.5} width={9} y={y(Math.max(c.o, c.c))} height={Math.max(2, Math.abs(y(c.o) - y(c.c)))} rx={1.5} fill={color} />
            </g>
          );
        })}
        <line x1={nowX + STEP / 2} x2={nowX + STEP / 2} y1={PAD - 6} y2={H - PAD} stroke={KRONOS} strokeDasharray="2 3" />
        <text x={nowX + STEP / 2 + 6} y={PAD + 2} fontSize="11" fill={KRONOS}>Kronos forecast →</text>
        <polygon points={band((f) => f.lo80, (f) => f.hi80)} fill={KRONOS} fillOpacity={0.1} />
        <polygon points={band((f) => f.lo50, (f) => f.hi50)} fill={KRONOS} fillOpacity={0.18} />
        <polyline
          points={[`${nowX},${y(last)}`, ...fan.map((f, i) => `${x(CANDLES.length + i)},${y(f.mid)}`)].join(" ")}
          fill="none"
          stroke={KRONOS}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      </svg>
      <div className="absolute bottom-6 left-6 rounded-xl border border-line bg-white/95 px-3.5 py-2.5 text-xs shadow-sm">
        <p className="text-ink-3">Kronos · next 10 days</p>
        <p className="mt-0.5 font-semibold text-ink">
          64% chance higher <span className="font-normal text-ink-3">· 80% range shown</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-up">
          <span className="h-1.5 w-1.5 rounded-full bg-up" /> Beat “no change” on this stock recently
        </p>
      </div>
    </div>
  );
}
