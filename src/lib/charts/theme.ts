// Chart colours: the validated reference palette (light surface). Text never wears a series colour.
export const COLORS = {
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
};

/** Diverging scales for "today's change" (heatmap). Red ↔ neutral grey ↔ green is the market convention but is
 *  weak for red-green colour blindness, so tiles also carry signed % labels and a blue ↔ red alternative exists. */
export const DIVERGING = {
  market: ["#b8302f", "#e34948", "#ef9a97", "#f0efec", "#7fcfae", "#1baf7a", "#12805a"],
  colorblind: ["#b8302f", "#e34948", "#ef9a97", "#f0efec", "#86b6ef", "#3987e5", "#1c5cab"],
};

export const FONT = "var(--font-open-sans), ui-sans-serif, system-ui, sans-serif";
