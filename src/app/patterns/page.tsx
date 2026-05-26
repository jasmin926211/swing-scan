'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const patterns = [
  {
    tier: 'Tier 1 - High Reliability (60-65% Win Rate)',
    color: 'border-green-500/30',
    items: [
      { name: 'Bullish Engulfing', direction: 'bullish', desc: 'Current bullish candle engulfs previous bearish candle. Strong reversal signal after downtrend.', timeframe: '2-5 days' },
      { name: 'Bearish Engulfing', direction: 'bearish', desc: 'Current bearish candle engulfs previous bullish candle. Strong reversal after uptrend.', timeframe: '2-5 days' },
      { name: 'Morning Star', direction: 'bullish', desc: '3-candle bullish reversal. Large bearish + small body + large bullish.', timeframe: '3-5 days' },
      { name: 'Evening Star', direction: 'bearish', desc: '3-candle bearish reversal. Large bullish + small body + large bearish.', timeframe: '3-5 days' },
      { name: 'Hammer', direction: 'bullish', desc: 'Long lower wick, small body at top. Buyers rejected lower prices. Best at support.', timeframe: '2-5 days' },
      { name: 'Shooting Star', direction: 'bearish', desc: 'Long upper wick, small body at bottom. Sellers rejected higher prices. Best at resistance.', timeframe: '2-5 days' },
      { name: 'Three White Soldiers', direction: 'bullish', desc: '3 consecutive bullish candles with progressively higher closes. Strong bullish continuation.', timeframe: '3-7 days' },
      { name: 'Three Black Crows', direction: 'bearish', desc: '3 consecutive bearish candles with progressively lower closes. Strong bearish continuation.', timeframe: '3-7 days' },
      { name: 'Bull Flag', direction: 'bullish', desc: 'Continuation after strong upward momentum. Pole + consolidation flag. Target = pole height.', timeframe: '3-7 days' },
      { name: 'Bear Flag', direction: 'bearish', desc: 'Continuation after strong downward momentum. Inverted pole + flag.', timeframe: '3-7 days' },
    ],
  },
  {
    tier: 'Tier 2 - Medium Reliability (Need Confluence, 52-60% Win Rate)',
    color: 'border-yellow-500/30',
    items: [
      { name: 'Piercing Line', direction: 'bullish', desc: 'Bearish candle then bullish candle that opens below low and closes above midpoint. Needs S/R confirmation.', timeframe: '2-5 days' },
      { name: 'Dark Cloud Cover', direction: 'bearish', desc: 'Bullish candle then bearish candle that opens above high and closes below midpoint.', timeframe: '2-5 days' },
      { name: 'Bullish Harami', direction: 'bullish', desc: 'Small bullish candle contained within previous large bearish candle. Weaker reversal signal.', timeframe: '2-5 days' },
      { name: 'Bearish Harami', direction: 'bearish', desc: 'Small bearish candle contained within previous large bullish candle.', timeframe: '2-5 days' },
      { name: 'Tweezer Bottom', direction: 'bullish', desc: 'Two candles with matching lows. Failed attempt to push price lower.', timeframe: '3-5 days' },
      { name: 'Tweezer Top', direction: 'bearish', desc: 'Two candles with matching highs. Failed attempt to push price higher.', timeframe: '3-5 days' },
      { name: 'Inside Bar', direction: 'neutral', desc: 'Current candle range inside previous candle range. Consolidation before breakout. Great for swing trades.', timeframe: '3-7 days' },
      { name: 'Double Bottom (W)', direction: 'bullish', desc: 'Two lows at same level. Entry above neckline. Very reliable reversal signal.', timeframe: '7-14 days' },
      { name: 'Double Top (M)', direction: 'bearish', desc: 'Two highs at same level. Entry below neckline. Classic bearish reversal.', timeframe: '7-14 days' },
      { name: 'Inverse Head & Shoulders', direction: 'bullish', desc: 'Three troughs, middle lowest. Strong bullish reversal above neckline.', timeframe: '7-14 days' },
      { name: 'Head & Shoulders', direction: 'bearish', desc: 'Three peaks, middle highest. Classic bearish reversal below neckline.', timeframe: '7-14 days' },
      { name: 'Falling Wedge', direction: 'bullish', desc: 'Converging downward trendlines. Bullish breakout above resistance.', timeframe: '5-10 days' },
      { name: 'Ascending Triangle', direction: 'bullish', desc: 'Flat resistance + higher lows. Powerful breakout when resistance breaks with volume.', timeframe: '5-10 days' },
      { name: 'Descending Triangle', direction: 'bearish', desc: 'Flat support + lower highs. Strong bearish continuation pattern.', timeframe: '5-10 days' },
      { name: 'Cup & Handle', direction: 'bullish', desc: 'U-shaped recovery with small handle pullback.', timeframe: '5-15 days' },
      { name: 'Golden Cross', direction: 'bullish', desc: '50-day EMA crosses above 200-day EMA. Long-term bullish trend confirmation.', timeframe: '7-30 days' },
      { name: 'Death Cross', direction: 'bearish', desc: '50-day EMA crosses below 200-day EMA. Long-term bearish trend confirmation.', timeframe: '7-30 days' },
    ],
  },
  {
    tier: 'Tier 3 - Early Warnings Only (Lower Reliability, 45-55%)',
    color: 'border-zinc-500/30',
    items: [
      { name: 'Rising Wedge', direction: 'bearish', desc: 'Converging upward trendlines. Bearish breakdown below support.', timeframe: '5-10 days' },
      { name: 'Rectangle Breakout', direction: 'bullish', desc: 'Horizontal consolidation range. Breakout with volume surge.', timeframe: '3-7 days' },
      { name: 'Channel Breakout', direction: 'bullish', desc: 'Price breaks above channel resistance.', timeframe: '3-5 days' },
      { name: 'Channel Breakdown', direction: 'bearish', desc: 'Price breaks below channel support.', timeframe: '3-5 days' },
      { name: 'Rounding Bottom', direction: 'bullish', desc: 'Gradual U-shaped recovery.', timeframe: '10-20 days' },
      { name: 'Symmetrical Triangle', direction: 'neutral', desc: 'Converging trendlines. Direction depends on breakout.', timeframe: '5-10 days' },
      { name: 'Gap Breakout', direction: 'bullish', desc: 'Significant price gap with volume surge.', timeframe: '2-5 days' },
      { name: 'EMA Crossover (9/21)', direction: 'bullish', desc: 'Fast EMA crosses slow EMA. Short-term momentum signal.', timeframe: '5-7 days' },
      { name: 'EMA Crossover (20/50)', direction: 'bullish', desc: 'Medium-term EMA crossover. Stronger trend shift.', timeframe: '7-14 days' },
    ],
  },
];

export default function PatternsPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Reference Guide
        </div>
        <h2 className="text-2xl font-bold text-card-foreground">Pattern Library</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          36 patterns detected by SwingScan, organized by reliability tier for 5-10 day swing trading
        </p>
      </div>

      {patterns.map((tier) => (
        <div key={tier.tier} className={`rounded-xl border bg-card ${tier.color}`}>
          <div className="border-b border-border px-6 py-4">
            <h3 className="text-base font-semibold text-card-foreground">{tier.tier}</h3>
          </div>
          <div className="divide-y divide-border">
            {tier.items.map((pattern) => (
              <div key={pattern.name} className="flex items-start gap-4 px-6 py-4">
                <div className={`mt-0.5 rounded-full p-1.5 ${
                  pattern.direction === 'bullish' ? 'bg-green-500/10' :
                  pattern.direction === 'bearish' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                }`}>
                  {pattern.direction === 'bullish' ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : pattern.direction === 'bearish' ? (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-foreground">{pattern.name}</h4>
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium ${
                      pattern.direction === 'bullish' ? 'border-green-500/20 bg-green-500/10 text-green-500' :
                      pattern.direction === 'bearish' ? 'border-red-500/20 bg-red-500/10 text-red-500' :
                      'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {pattern.direction}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {pattern.timeframe}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{pattern.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 5-Point Confluence Checklist */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-primary/70">
          Scoring System
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">5-Point Confluence Checklist</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Only take trades scoring 3 or higher. Each confirmed factor adds +1 to the score.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-card p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">1. Daily pattern</span> - confirmed candlestick or chart pattern on daily timeframe
          </div>
          <div className="rounded-lg bg-card p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">2. Volume &ge; 1.5x</span> - above-average volume confirms conviction
          </div>
          <div className="rounded-lg bg-card p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">3. At key level</span> - pattern at support, resistance, or Fibonacci level
          </div>
          <div className="rounded-lg bg-card p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">4. Weekly trend aligned</span> - weekly EMA trend agrees with signal direction
          </div>
          <div className="rounded-lg bg-card p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">5. RSI confirms</span> - RSI oversold for bullish, overbought for bearish
          </div>
        </div>
      </div>

      {/* Volume Filter Rule */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-yellow-500/70">
          Filter Rule
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">Hard Volume Filter Rule</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          All reversal patterns (engulfing, hammer, star, harami, tweezers, piercing line, dark cloud cover, double top/bottom, H&S)
          are <strong className="text-foreground">automatically rejected</strong> if the confirming candle&apos;s volume is below 1.5x the 20-day average.
          This eliminates low-conviction noise and dramatically improves signal accuracy.
        </p>
      </div>
    </div>
  );
}
