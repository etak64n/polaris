// Turns daily usage into chart rows: one row per date, one series per resource.
//
// The five resources that use the most get the five colors, and the rest fold into
// "Other", so a bar still adds up to the whole account. When resources are picked,
// the charts show only those. A resource has the same color in every chart of the
// page, and picking resources never repaints the five that use the most.

import type { DailyUsage } from "../../shared/usage.ts";
import { OTHER_COLOR, SERIES_COLORS } from "./palette.ts";

export const OTHER_KEY = "other";

/** The most resources that a chart shows one by one, one per color. */
export const MAX_PICKED = SERIES_COLORS.length;

export interface Series {
  /** The resource, such as a Worker name or a D1 database ID. */
  key: string;
  /** A short key for the chart data and its CSS variables, such as s0 or "other". */
  chartKey: string;
  label: string;
  color: string;
}

/** The resources of one product that a day used, with one value per metric. */
export type ResourceValues = (day: DailyUsage) => { key: string; values: number[] }[];

export interface ProductColors {
  /** Series in the order of the stack from the bottom, with "Other" last. */
  series: Series[];
  /** The series of a resource, or null when the charts leave it out. */
  seriesOf: (key: string) => Series | null;
  /** Every resource that used something, the largest first. */
  ranked: string[];
}

/**
 * Gives colors to the resources. A resource scores its share of each metric, so a
 * database that writes much and reads little still counts.
 */
export function productColors(
  days: DailyUsage[],
  resources: ResourceValues,
  labelOf: (key: string) => string,
  picked: readonly string[],
): ProductColors {
  const ranked = rank(days, resources);
  const defaultColors = new Map(ranked.slice(0, SERIES_COLORS.length).map((key, index) => [key, SERIES_COLORS[index] ?? OTHER_COLOR]));

  if (picked.length === 0) {
    const series = [...defaultColors].map(([key, color], index) => ({ key, chartKey: `s${index}`, label: labelOf(key), color }));
    const byKey = new Map(series.map((item) => [item.key, item]));
    const other: Series = { key: OTHER_KEY, chartKey: OTHER_KEY, label: "Other", color: OTHER_COLOR };
    if (ranked.length > series.length) series.push(other);
    // A resource that used nothing in the range is in no series, not even "Other".
    const used = new Set(ranked);
    return { series, seriesOf: (key) => byKey.get(key) ?? (used.has(key) ? other : null), ranked };
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
  return { series, seriesOf: (key) => byKey.get(key) ?? null, ranked };
}

function rank(days: DailyUsage[], resources: ResourceValues): string[] {
  const totals = new Map<string, number[]>();
  for (const day of days) {
    for (const { key, values } of resources(day)) {
      const sums = totals.get(key) ?? values.map(() => 0);
      values.forEach((value, index) => {
        sums[index] = (sums[index] ?? 0) + value;
      });
      totals.set(key, sums);
    }
  }
  const metricTotals: number[] = [];
  for (const sums of totals.values()) {
    sums.forEach((value, index) => {
      metricTotals[index] = (metricTotals[index] ?? 0) + value;
    });
  }
  const score = (sums: number[]): number =>
    sums.reduce((total, value, index) => total + (metricTotals[index] ? value / (metricTotals[index] ?? 1) : 0), 0);
  return [...totals.entries()]
    .filter(([, sums]) => score(sums) > 0)
    .sort((a, b) => score(b[1]) - score(a[1]) || a[0].localeCompare(b[0]))
    .map(([key]) => key);
}

export type ChartRow = { date: string } & Record<string, number | string>;

/** One row per date with the value of each series, for one metric. */
export function chartRows(days: DailyUsage[], colors: ProductColors, resources: ResourceValues, metricIndex: number): ChartRow[] {
  return days.map((day) => {
    const row: ChartRow = { date: day.date };
    for (const series of colors.series) row[series.chartKey] = 0;
    for (const { key, values } of resources(day)) {
      const series = colors.seriesOf(key);
      if (series !== null) row[series.chartKey] = (row[series.chartKey] as number) + (values[metricIndex] ?? 0);
    }
    return row;
  });
}
