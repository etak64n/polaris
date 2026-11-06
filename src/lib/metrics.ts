// Labels of the periods and the times on the metric charts. A day is a UTC date,
// as Cloudflare analytics count days in UTC; shorter periods show the local time.

import { PERIOD_SECONDS, type Period, type Statistic } from "../../shared/metrics.ts";
import type { ChartSeries } from "@/components/MetricChart.tsx";
import { formatDate } from "./format.ts";
import { INK_COLOR, MUTED_COLOR } from "./palette.ts";
import type { ProductColors } from "./series.ts";

export const PERIOD_LABELS: Record<Period, string> = { "1m": "1 min", "5m": "5 min", "15m": "15 min", "1h": "1 hour", "1d": "1 day" };

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function localDate(time: Date): string {
  return `${time.getFullYear()}/${twoDigits(time.getMonth() + 1)}/${twoDigits(time.getDate())}`;
}

function localClock(time: Date): string {
  return `${twoDigits(time.getHours())}:${twoDigits(time.getMinutes())}`;
}

const HOUR_MS = 3_600_000;

/**
 * A label at an end of the time axis, which shows only its two ends: the clock for
 * a span of a few hours, the date and the clock for a span of a day or two, and
 * the date for longer spans.
 */
export function axisEndLabel(iso: string, period: Period, spanMs: number): string {
  if (period === "1d") return formatDate(iso.slice(0, 10));
  const time = new Date(iso);
  if (spanMs <= 6 * HOUR_MS) return localClock(time);
  if (spanMs <= 48 * HOUR_MS) return `${localDate(time)} ${localClock(time)}`;
  return localDate(time);
}

/** A moment, such as 2026/11/06 10:35, or the UTC date of a day. */
export function timeLabel(iso: string, period: Period): string {
  if (period === "1d") return formatDate(iso.slice(0, 10));
  const time = new Date(iso);
  return `${localDate(time)} ${localClock(time)}`;
}

/** The span of one period, such as 2026/11/06 10:35 – 10:40, which shows how long a period is. */
export function periodLabel(iso: string, period: Period): string {
  if (period === "1d") return formatDate(iso.slice(0, 10));
  const start = new Date(iso);
  const end = new Date(start.getTime() + PERIOD_SECONDS[period] * 1000);
  return `${localDate(start)} ${localClock(start)} – ${localClock(end)}`;
}

/** The series of a sum or a gauge, one per shown resource and "Other", in the colors of the resources. */
export function resourceSeries(values: Record<string, (number | null)[]> | undefined, colors: ProductColors): ChartSeries[] {
  return colors.series.flatMap((item) => {
    const series = values?.[item.key];
    return series === undefined ? [] : [{ key: item.key, label: item.label, color: item.color, values: series }];
  });
}

/** The p99 and p50 lines of a quantile, in ink rather than the colors of the resources. */
export function statisticSeries(values: Record<Statistic, (number | null)[]> | undefined): ChartSeries[] {
  if (values === undefined) return [];
  return [
    { key: "p99", label: "p99", color: INK_COLOR, values: values.p99 },
    { key: "p50", label: "p50", color: MUTED_COLOR, values: values.p50 },
  ];
}
