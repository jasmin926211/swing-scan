import { useTheme } from "@/lib/theme";

// Chart colours: the validated reference palette, one set per theme (each checked against its own surface).
// Text never wears a series colour.
const LIGHT = {
  up: "#1baf7a",
  down: "#e34948",
  forecast: "#2a78d6", // categorical slot 1
  second: "#eb6834", // categorical slot 2
  ink: "#0b0b0b",
  ink2: "#52514e",
  ink3: "#8a8983",
  line: "#ebebe8",
  wash: "#f7f7f5",
  volume: "#d9d9d5",
  crosshair: "#c9c9c4",
  paper: "#ffffff",
};

const DARK: typeof LIGHT = {
  up: "#1baf7a",
  down: "#e34948",
  forecast: "#4a8fe6",
  second: "#e2602c",
  ink: "#ededea",
  ink2: "#b4b3ad",
  ink3: "#8a8983",
  line: "#2a2a27",
  wash: "#1b1b19",
  volume: "#3a3a36",
  crosshair: "#5a5a54",
  paper: "#111110",
};

export type ChartColors = typeof LIGHT;

/** Diverging scales for "today's change" (heatmap). Red ↔ neutral grey ↔ green is the market convention but is
 *  weak for red-green colour blindness, so tiles also carry signed % labels and a blue ↔ red alternative exists.
 *  On the dark surface magnitude runs dark → bright, so the neutral middle sits near the background. */
const DIVERGING_LIGHT = {
  market: ["#b8302f", "#e34948", "#ef9a97", "#f0efec", "#7fcfae", "#1baf7a", "#12805a"],
  colorblind: ["#b8302f", "#e34948", "#ef9a97", "#f0efec", "#86b6ef", "#3987e5", "#1c5cab"],
};
const DIVERGING_DARK: typeof DIVERGING_LIGHT = {
  market: ["#e34948", "#a83a39", "#5c2826", "#2a2a27", "#1c5240", "#178a61", "#1baf7a"],
  colorblind: ["#e34948", "#a83a39", "#5c2826", "#2a2a27", "#1f4470", "#2f6fc0", "#4a8fe6"],
};
export type DivergingName = keyof typeof DIVERGING_LIGHT;

export function useChartColors(): ChartColors {
  return useTheme() === "dark" ? DARK : LIGHT;
}

export function useDiverging() {
  return useTheme() === "dark" ? DIVERGING_DARK : DIVERGING_LIGHT;
}

export const FONT = "var(--font-open-sans), ui-sans-serif, system-ui, sans-serif";
