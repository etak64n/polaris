// Colors of the chart series. The theme defines them as --chart-1 to --chart-5, in a
// validated order that stays apart for color-blind readers, and the next series always
// takes the next slot. Resources past the last slot fold into "Other", in gray.

export const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;

export const OTHER_COLOR = "#a1a1aa";

/** Line of a free daily limit on a chart. */
export const LIMIT_COLOR = "var(--destructive)";
