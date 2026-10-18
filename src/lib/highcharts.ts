import type * as HighchartsNS from "highcharts";

export type Highcharts = typeof HighchartsNS;

let loading: Promise<Highcharts> | null = null;

/** Highstock + highcharts-more (arearange), loaded once and only in the browser.
 *  Modules attach to the instance Highstock registers globally, so order matters. */
export function loadHighcharts(): Promise<Highcharts> {
  loading ??= (async () => {
    const H = (await import("highcharts/highstock")).default as unknown as Highcharts;
    await import("highcharts/highcharts-more");
    await import("highcharts/modules/accessibility");
    return H;
  })();
  return loading;
}

// Validated reference palette (light surface).
export const COLORS = {
  up: "#1baf7a",
  down: "#e34948",
  kronos: "#2a78d6", // categorical slot 1
  second: "#eb6834", // categorical slot 2
  ink2: "#52514e",
  ink3: "#8a8983",
  line: "#ebebe8",
};
