// The free usage of each metric, which the charts mark with a line.
//
// On the Free plan, Workers requests and D1 rows have a daily limit, past which the
// account stops serving them until 00:00 UTC. Other usage is free up to a monthly
// amount, which a daily chart shows as the same amount spread over the days of the
// billing cycle.

import type { PlanType } from "../../shared/plan.ts";
import { FREE_D1_STORAGE_BYTES, FREE_DAILY_LIMITS, GB, PAID_PRICES, R2_PRICES } from "../../shared/pricing.ts";
import { formatBytes, formatCompact, formatDuration } from "./format.ts";

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

/** The free line of a chart, or null when the metric has no free amount on the plan. */
export function freeLine(metric: ChartMetric, plan: PlanType, cycleDays: number): FreeLine | null {
  const free = plan === "free";
  switch (metric) {
    case "workerRequests":
      return free ? dailyLimit(FREE_DAILY_LIMITS.workerRequests) : monthly(PAID_PRICES.workerRequests.included, cycleDays, "Included", formatCompact);
    case "workerCpuMs":
      // The Free plan limits the CPU time of each request, not the total.
      return free ? null : monthly(PAID_PRICES.workerCpuMs.included, cycleDays, "Included", formatDuration);
    case "d1RowsRead":
      return free ? dailyLimit(FREE_DAILY_LIMITS.d1RowsRead) : monthly(PAID_PRICES.d1RowsRead.included, cycleDays, "Included", formatCompact);
    case "d1RowsWritten":
      return free ? dailyLimit(FREE_DAILY_LIMITS.d1RowsWritten) : monthly(PAID_PRICES.d1RowsWritten.included, cycleDays, "Included", formatCompact);
    case "d1StorageBytes":
      return free
        ? { value: FREE_D1_STORAGE_BYTES, label: `Free limit ${formatBytes(FREE_D1_STORAGE_BYTES)}`, limit: true }
        : size(PAID_PRICES.d1Storage.includedGb * GB, "Included");
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
