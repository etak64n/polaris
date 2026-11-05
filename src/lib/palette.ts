// Colors of the chart series. They follow a validated categorical order (checked
// for color-blind separation against the white panel), and the next series always
// takes the next slot. Resources past the last slot fold into "Other", in gray.

export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;

export const OTHER_COLOR = "#b3b8b4";

/** Line of a free daily limit on a chart. */
export const LIMIT_COLOR = "#b83d35";
