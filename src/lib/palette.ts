// Colors of the chart series. The theme defines them as --chart-1 to --chart-5, in a
// validated order that stays apart for color-blind readers, and the next series always
// takes the next slot. Resources past the last slot fold into "Other", in gray.

export const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const;

export const OTHER_COLOR = "var(--ds-series-other)";

/** Lines that stand for no resource, such as the p99 and p50 of a quantile. */
export const INK_COLOR = "var(--ds-series-ink)";
export const MUTED_COLOR = "var(--ds-series-muted)";
