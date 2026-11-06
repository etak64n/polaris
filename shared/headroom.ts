// How much room the account has under each limit of the Workers Free plan, and
// under the monthly free amounts of R2.
//
// Past a limit of the Free plan, the usage stops instead of costing money: Workers
// answer with Error 1027 and D1 queries fail until 00:00 UTC. The headroom under
// the busiest day of the last days tells whether the account needs the Workers Paid
// plan. R2 bills past its free amounts on both plans, so its headroom is about cost.
//
// Sources, checked on PRICES_CHECKED_ON:
//   https://developers.cloudflare.com/workers/platform/limits/
//   https://developers.cloudflare.com/d1/platform/limits/

import type { CostLine } from "./cost.ts";
import { FREE_D1_STORAGE_BYTES, FREE_DAILY_LIMITS } from "./pricing.ts";
import type { DailyUsage } from "./usage.ts";

/** The largest D1 database that the Workers Free plan allows. */
export const FREE_D1_DATABASE_BYTES = 500_000_000;

/** D1 databases that the Workers Free plan allows in an account. */
export const FREE_D1_DATABASES = 10;

export type HeadroomBasis =
  /** The busiest UTC day of the days that the overview holds. */
  | "busiest-day"
  /** The size or the count now. */
  | "now"
  /** The usage of the billing cycle, projected to its end. */
  | "cycle";

export interface Headroom {
  id: string;
  product: "Workers" | "D1" | "R2";
  /** What the limit counts, such as "Requests per day". */
  item: string;
  /** The usage that the limit compares with. */
  used: number;
  limit: number;
  unit: "count" | "bytes" | "GB-month";
  basis: HeadroomBasis;
  /** The day of the usage, for the busiest day. */
  date: string | null;
  /** The usage of today, for a daily limit, which shows whether the busiest day is past. */
  today: number | null;
  /** What happens past the limit: the usage stops, or it costs money. */
  past: "stops" | "billed";
  /** The share of the limit that the usage leaves: 1 − used ÷ limit. Below zero past the limit. */
  headroom: number;
}

/**
 * The headroom under every limit, the least first. `days` are the days of the
 * overview, oldest first; `databases` is the number of D1 databases; `r2Lines` are
 * the R2 lines of the cost estimate of the cycle.
 */
export function freeHeadroom(days: DailyUsage[], databases: number, r2Lines: CostLine[]): Headroom[] {
  const latest = days.at(-1);
  const list: Headroom[] = [
    busiest(days, "workers-requests", "Workers", "Requests per day", FREE_DAILY_LIMITS.workerRequests, (day) =>
      sum(day.workers.map((worker) => worker.requests)),
    ),
    busiest(days, "d1-rows-read", "D1", "Rows read per day", FREE_DAILY_LIMITS.d1RowsRead, (day) =>
      sum(day.d1.map((database) => database.rowsRead)),
    ),
    busiest(days, "d1-rows-written", "D1", "Rows written per day", FREE_DAILY_LIMITS.d1RowsWritten, (day) =>
      sum(day.d1.map((database) => database.rowsWritten)),
    ),
    now("d1-storage", "D1", "Storage of all databases", sum((latest?.d1 ?? []).map((database) => database.storageBytes)), FREE_D1_STORAGE_BYTES, "bytes"),
    now("d1-largest", "D1", "Size of the largest database", Math.max(0, ...(latest?.d1 ?? []).map((database) => database.storageBytes)), FREE_D1_DATABASE_BYTES, "bytes"),
    now("d1-databases", "D1", "Databases", databases, FREE_D1_DATABASES, "count"),
  ];
  for (const line of r2Lines) {
    if (line.product !== "R2" || line.included === null) continue;
    const used = line.projectedUsed ?? line.used;
    list.push({
      id: `r2-${line.item.toLowerCase().replaceAll(" ", "-")}`,
      product: "R2",
      item: line.unit === "GB-month" ? "Storage per month" : `${line.item} per month`,
      used,
      limit: line.included,
      unit: line.unit === "GB-month" ? "GB-month" : "count",
      basis: "cycle",
      date: null,
      today: null,
      past: "billed",
      headroom: 1 - used / line.included,
    });
  }
  return list.sort((a, b) => a.headroom - b.headroom);
}

function busiest(
  days: DailyUsage[],
  id: string,
  product: Headroom["product"],
  item: string,
  limit: number,
  of: (day: DailyUsage) => number,
): Headroom {
  let used = 0;
  let date: string | null = null;
  for (const day of days) {
    const value = of(day);
    if (date === null || value > used) {
      used = value;
      date = day.date;
    }
  }
  const latest = days.at(-1);
  const today = latest === undefined ? null : of(latest);
  return { id, product, item, used, limit, unit: "count", basis: "busiest-day", date, today, past: "stops", headroom: 1 - used / limit };
}

function now(id: string, product: Headroom["product"], item: string, used: number, limit: number, unit: Headroom["unit"]): Headroom {
  return { id, product, item, used, limit, unit, basis: "now", date: null, today: null, past: "stops", headroom: 1 - used / limit };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
