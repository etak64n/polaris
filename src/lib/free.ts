// The Free plan of each metric, which the charts mark with a line.
//
// Workers requests and D1 rows have a daily limit on the Free plan, past which the
// account stops serving them until 00:00 UTC. R2 is free up to a monthly amount on
// either plan, which a daily chart shows as the same amount spread over the days of
// the billing cycle.

import { FREE_D1_STORAGE_BYTES, FREE_DAILY_LIMITS, GB, R2_PRICES } from "../../shared/pricing.ts";
import { formatBytes, formatCompact } from "./format.ts";

export interface FreeLine {
  /** The height of the line on the chart. */
  value: number;
  label: string;
  /** A limit that stops the usage, rather than an amount past which it costs money. */
  limit: boolean;
}

export type ChartMetric =
  | "workerRequests"
  | "workerCpuMs"
  | "d1RowsRead"
  | "d1RowsWritten"
  | "d1StorageBytes"
  | "r2ClassA"
  | "r2ClassB"
  | "r2StorageBytes";

/**
 * The line of a chart at the Free plan, or null when the metric has none. The charts draw
 * the Free plan on either plan, so that an account on Workers Paid sees whether its usage
 * would fit the Free plan again.
 */
export function freeLine(metric: ChartMetric, cycleDays: number): FreeLine | null {
  switch (metric) {
    case "workerRequests":
      return dailyLimit(FREE_DAILY_LIMITS.workerRequests);
    case "workerCpuMs":
      // The Free plan limits the CPU time of each request, not the total.
      return null;
    case "d1RowsRead":
      return dailyLimit(FREE_DAILY_LIMITS.d1RowsRead);
    case "d1RowsWritten":
      return dailyLimit(FREE_DAILY_LIMITS.d1RowsWritten);
    case "d1StorageBytes":
      return { value: FREE_D1_STORAGE_BYTES, label: `Free limit ${formatBytes(FREE_D1_STORAGE_BYTES)}`, limit: true };
    case "r2ClassA":
      return monthly(R2_PRICES.classA.included, cycleDays, "Free", formatCompact);
    case "r2ClassB":
      return monthly(R2_PRICES.classB.included, cycleDays, "Free", formatCompact);
    case "r2StorageBytes":
      return size(R2_PRICES.storage.includedGb * GB, "Free");
  }
}

function dailyLimit(perDay: number): FreeLine {
  return { value: perDay, label: `Free limit ${formatCompact(perDay)}/day`, limit: true };
}

function monthly(perMonth: number, cycleDays: number, name: string, format: (value: number) => string): FreeLine {
  const perDay = perMonth / cycleDays;
  return { value: perDay, label: `${name} ${format(perMonth)}/month (${format(perDay)}/day)`, limit: false };
}

function size(bytes: number, name: string): FreeLine {
  return { value: bytes, label: `${name} ${formatBytes(bytes)}`, limit: false };
}
