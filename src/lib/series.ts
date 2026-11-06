// Colors of the resources on the charts of a page.
//
// The five resources that use the most get the five colors, and the rest fold into
// "Other". When resources are picked, the charts show only those. A resource has
// the same color in every chart of the page, and picking resources never repaints
// the five that use the most.

import { MAX_PICKED_RESOURCES, OTHER_SERIES } from "../../shared/metrics.ts";
import { OTHER_COLOR, SERIES_COLORS } from "./palette.ts";

export const OTHER_KEY = OTHER_SERIES;

/** The most resources that a chart shows one by one, one per color. */
export const MAX_PICKED = Math.min(MAX_PICKED_RESOURCES, SERIES_COLORS.length);

export interface Series {
  /** The resource, such as a Worker name or a D1 database ID, or OTHER_KEY. */
  key: string;
  /** A short key for the chart data and its CSS variables, such as s0 or "other". */
  chartKey: string;
  label: string;
  color: string;
}

export interface ProductColors {
  /** Series in the order of the stack from the bottom, with "Other" last. */
  series: Series[];
  /** The series of a resource, or null when the charts leave it out. */
  seriesOf: (key: string) => Series | null;
  /** Every resource with data, the largest first. */
  ranked: string[];
}

/** Gives colors to the resources, ranked the largest first as the metrics API ranks them. */
export function productColors(ranked: readonly string[], labelOf: (key: string) => string, picked: readonly string[]): ProductColors {
  const defaultColors = new Map(ranked.slice(0, SERIES_COLORS.length).map((key, index) => [key, SERIES_COLORS[index] ?? OTHER_COLOR]));

  if (picked.length === 0) {
    const series = [...defaultColors].map(([key, color], index) => ({ key, chartKey: `s${index}`, label: labelOf(key), color }));
    const byKey = new Map(series.map((item) => [item.key, item]));
    const other: Series = { key: OTHER_KEY, chartKey: OTHER_KEY, label: "Other", color: OTHER_COLOR };
    if (ranked.length > series.length) series.push(other);
    const known = new Set(ranked);
    return { series, seriesOf: (key) => byKey.get(key) ?? (known.has(key) ? other : null), ranked: [...ranked] };
  }

  // A picked resource keeps its color from the five; the others take the colors that are left.
  const taken = new Set(picked.map((key) => defaultColors.get(key)).filter((color) => color !== undefined));
  const left = SERIES_COLORS.filter((color) => !taken.has(color));
  const colorOf = new Map(picked.map((key) => [key, defaultColors.get(key) ?? left.shift() ?? OTHER_COLOR]));
  const position = (key: string): number => {
    const index = ranked.indexOf(key);
    return index === -1 ? ranked.length : index;
  };
  const series = [...picked]
    .sort((a, b) => position(a) - position(b))
    .map((key, index) => ({ key, chartKey: `s${index}`, label: labelOf(key), color: colorOf.get(key) ?? OTHER_COLOR }));
  const byKey = new Map(series.map((item) => [item.key, item]));
  return { series, seriesOf: (key) => byKey.get(key) ?? null, ranked: [...ranked] };
}
