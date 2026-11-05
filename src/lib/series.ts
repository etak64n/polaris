// Turns daily usage into chart rows: one row per date, one series per resource.
//
// Each product gives its resources fixed colors for the whole page, so a D1
// database has the same color in the rows read chart and the rows written chart.
// The resources that use the most get the colors; the rest fold into "Other".

import type { DailyUsage } from "../../shared/usage.ts";
import { OTHER_COLOR, SERIES_COLORS } from "./palette.ts";

export const OTHER_KEY = "__other";

export interface Series {
  key: string;
  label: string;
  color: string;
}

/** The resources of one product that a day used, with one value per metric. */
export type ResourceValues = (day: DailyUsage) => { key: string; values: number[] }[];

export interface ProductColors {
  /** Series that have their own color, in color order, then "Other" if any resource folds into it. */
  series: Series[];
  seriesOf: (key: string) => Series;
}

/**
 * Gives colors to the resources that use the most. A resource scores its share of
 * each metric, so a database that writes much and reads little still counts.
 */
export function productColors(days: DailyUsage[], resources: ResourceValues, labelOf: (key: string) => string): ProductColors {
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
  const ranked = [...totals.entries()]
    .filter(([, sums]) => score(sums) > 0)
    .sort((a, b) => score(b[1]) - score(a[1]) || a[0].localeCompare(b[0]))
    .map(([key]) => key);

  const colored = new Map<string, Series>();
  ranked.slice(0, SERIES_COLORS.length).forEach((key, index) => {
    colored.set(key, { key, label: labelOf(key), color: SERIES_COLORS[index] ?? OTHER_COLOR });
  });
  const other: Series = { key: OTHER_KEY, label: "Other", color: OTHER_COLOR };
  const series = [...colored.values()];
  if (ranked.length > SERIES_COLORS.length) series.push(other);
  return { series, seriesOf: (key) => colored.get(key) ?? other };
}

export type ChartRow = { date: string } & Record<string, number | string>;

/** One row per date with the value of each series, for one metric. */
export function chartRows(
  days: DailyUsage[],
  colors: ProductColors,
  resources: ResourceValues,
  metricIndex: number,
  scale = 1,
): ChartRow[] {
  return days.map((day) => {
    const row: ChartRow = { date: day.date };
    for (const series of colors.series) row[series.key] = 0;
    for (const { key, values } of resources(day)) {
      const series = colors.seriesOf(key);
      row[series.key] = (row[series.key] as number) + (values[metricIndex] ?? 0) / scale;
    }
    return row;
  });
}
