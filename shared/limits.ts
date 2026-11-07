// The limits of the Workers Free plan, and the share of each that the usage leaves:
// the daily limits against the usage of today, the sizes and the counts now, and the
// monthly free amounts of R2 projected to the end of the billing cycle.
//
// Past a limit of the Free plan, the usage stops instead of costing money: Workers
// answer with Error 1027, and the queries, operations, and invocations of the other
// products fail until 00:00 UTC. R2 bills past its free amounts on both plans.
//
// Sources, checked on 2026-11-07:
//   https://developers.cloudflare.com/workers/platform/limits/
//   https://developers.cloudflare.com/workers/platform/pricing/
//   https://developers.cloudflare.com/d1/platform/limits/
//   https://developers.cloudflare.com/kv/platform/pricing/
//   https://developers.cloudflare.com/durable-objects/platform/pricing/
//   https://developers.cloudflare.com/queues/platform/pricing/
//   https://developers.cloudflare.com/workers-ai/platform/pricing/
//   https://developers.cloudflare.com/hyperdrive/platform/pricing/
//   https://developers.cloudflare.com/browser-run/limits/
//   https://developers.cloudflare.com/workflows/reference/pricing/
//   https://developers.cloudflare.com/pages/functions/pricing/
//   https://developers.cloudflare.com/workers/observability/metrics-and-analytics/#invocation-statuses

import type { CostLine } from "./cost.ts";
import { FREE_D1_STORAGE_BYTES, FREE_DAILY_LIMITS, GB } from "./pricing.ts";
import type { DailyUsage } from "./usage.ts";

/** The largest D1 database that the Workers Free plan allows. */
export const FREE_D1_DATABASE_BYTES = 500_000_000;

/** D1 databases that the Workers Free plan allows in an account. */
export const FREE_D1_DATABASES = 10;

/** Cron Triggers that the Workers Free plan allows in an account. */
export const FREE_CRON_TRIGGERS = 5;

/** CPU time that the Workers Free plan allows each HTTP request and each Cron Trigger, in milliseconds. */
export const FREE_CPU_MS_PER_INVOCATION = 10;

/** Daily limits of Workers KV on the Free plan, for the whole account. */
export const FREE_KV_DAILY_LIMITS = { reads: 100_000, writes: 1_000, deletes: 1_000, lists: 1_000 } as const;

/** Daily limits of Durable Objects on the Free plan. Its rows have the same numbers as those of D1. */
export const FREE_DURABLE_OBJECTS_DAILY_LIMITS = { requests: 100_000, gbSeconds: 13_000, rowsRead: 5_000_000, rowsWritten: 100_000 } as const;

/** The SQLite data of every Durable Object that the Free plan allows. */
export const FREE_DURABLE_OBJECTS_STORAGE_BYTES = 5 * GB;

/** Daily limits of the other products on the Free plan. Browser Run allows 10 minutes of browser time. */
export const FREE_OTHER_DAILY_LIMITS = {
  queuesOperations: 10_000,
  workersAiNeurons: 10_000,
  hyperdriveQueries: 100_000,
  browserRunMinutes: 10,
  workflowsSteps: 3_000,
} as const;

export interface FreeLimit {
  id: string;
  product: "Workers" | "D1" | "KV" | "R2" | "Durable Objects" | "Queues" | "Workers AI" | "Hyperdrive" | "Browser Run" | "Workflows";
  /** What the limit counts, such as "Rows read". */
  item: string;
  /** The usage that the limit compares with: of today, now, or projected for the cycle. */
  used: number;
  limit: number;
  unit: "count" | "bytes" | "GB-month" | "GB-s" | "minutes";
  /** The share of the limit that the usage leaves: 1 − used ÷ limit. Below zero past the limit. */
  left: number;
}

export interface FreeLimits {
  /** The limits per day, against the usage of today, the UTC day that ends the days. They reset at 00:00 UTC. */
  daily: FreeLimit[];
  /** The limits on sizes and counts, against the usage now. */
  sizes: FreeLimit[];
  /** The free amounts of R2 per month, against the usage projected to the end of the cycle. */
  monthly: FreeLimit[];
  /** Requests that a limit stopped during all the days: the CPU time, the subrequests, or the daily requests. */
  stopped: number;
}

/**
 * The Free plan limits of the account, each group with the least left first. `days`
 * are the days of the overview, oldest first; `databases` is the number of D1
 * databases; `cronTriggers` is the number of Cron Triggers of the Workers; `r2Lines`
 * are the R2 lines of the cost estimate of the cycle.
 */
export function freeLimits(days: DailyUsage[], databases: number, cronTriggers: number, r2Lines: CostLine[]): FreeLimits {
  const latest = days.at(-1);
  const byLeft = (a: FreeLimit, b: FreeLimit): number => a.left - b.left;
  const daily = [
    // Requests to Pages Functions count toward the requests of Workers.
    ofToday(latest, "workers-requests", "Workers", "Requests", FREE_DAILY_LIMITS.workerRequests, (day) =>
      sum(day.workers.map((worker) => worker.requests)) + day.pagesFunctionsRequests,
    ),
    ofToday(latest, "d1-rows-read", "D1", "Rows read", FREE_DAILY_LIMITS.d1RowsRead, (day) =>
      sum(day.d1.map((database) => database.rowsRead)),
    ),
    ofToday(latest, "d1-rows-written", "D1", "Rows written", FREE_DAILY_LIMITS.d1RowsWritten, (day) =>
      sum(day.d1.map((database) => database.rowsWritten)),
    ),
    ofToday(latest, "kv-reads", "KV", "Reads", FREE_KV_DAILY_LIMITS.reads, (day) => day.kv.reads),
    ofToday(latest, "kv-writes", "KV", "Writes", FREE_KV_DAILY_LIMITS.writes, (day) => day.kv.writes),
    ofToday(latest, "kv-deletes", "KV", "Deletes", FREE_KV_DAILY_LIMITS.deletes, (day) => day.kv.deletes),
    ofToday(latest, "kv-lists", "KV", "Lists", FREE_KV_DAILY_LIMITS.lists, (day) => day.kv.lists),
    ofToday(latest, "do-requests", "Durable Objects", "Requests", FREE_DURABLE_OBJECTS_DAILY_LIMITS.requests, (day) => day.durableObjects.requests),
    ofToday(latest, "do-duration", "Durable Objects", "Duration", FREE_DURABLE_OBJECTS_DAILY_LIMITS.gbSeconds, (day) => day.durableObjects.gbSeconds, "GB-s"),
    ofToday(latest, "do-rows-read", "Durable Objects", "Rows read", FREE_DURABLE_OBJECTS_DAILY_LIMITS.rowsRead, (day) => day.durableObjects.rowsRead),
    ofToday(latest, "do-rows-written", "Durable Objects", "Rows written", FREE_DURABLE_OBJECTS_DAILY_LIMITS.rowsWritten, (day) => day.durableObjects.rowsWritten),
    ofToday(latest, "queues-operations", "Queues", "Operations", FREE_OTHER_DAILY_LIMITS.queuesOperations, (day) => day.queuesOperations),
    ofToday(latest, "workers-ai-neurons", "Workers AI", "Neurons", FREE_OTHER_DAILY_LIMITS.workersAiNeurons, (day) => day.workersAiNeurons),
    ofToday(latest, "hyperdrive-queries", "Hyperdrive", "Queries", FREE_OTHER_DAILY_LIMITS.hyperdriveQueries, (day) => day.hyperdriveQueries),
    ofToday(latest, "browser-run-time", "Browser Run", "Browser time", FREE_OTHER_DAILY_LIMITS.browserRunMinutes, (day) => day.browserRunMs / 60_000, "minutes"),
    ofToday(latest, "workflows-steps", "Workflows", "Steps", FREE_OTHER_DAILY_LIMITS.workflowsSteps, (day) => day.workflowsSteps),
  ];
  const sizes = (latest?.d1 ?? []).map((database) => database.storageBytes);
  const now = [
    current("workers-cron-triggers", "Workers", "Cron Triggers", cronTriggers, FREE_CRON_TRIGGERS, "count"),
    current("d1-storage", "D1", "Storage", sum(sizes), FREE_D1_STORAGE_BYTES, "bytes"),
    current("d1-largest", "D1", "Largest database", Math.max(0, ...sizes), FREE_D1_DATABASE_BYTES, "bytes"),
    current("d1-databases", "D1", "Databases", databases, FREE_D1_DATABASES, "count"),
    current("do-storage", "Durable Objects", "Storage", latest?.durableObjects.storageBytes ?? 0, FREE_DURABLE_OBJECTS_STORAGE_BYTES, "bytes"),
  ];
  const monthly: FreeLimit[] = [];
  for (const line of r2Lines) {
    if (line.product !== "R2" || line.included === null) continue;
    const used = line.projectedUsed ?? line.used;
    monthly.push({
      id: `r2-${line.item.toLowerCase().replaceAll(" ", "-")}`,
      product: "R2",
      item: line.item,
      used,
      limit: line.included,
      unit: line.unit === "GB-month" ? "GB-month" : "count",
      left: 1 - used / line.included,
    });
  }
  return {
    daily: daily.sort(byLeft),
    sizes: now.sort(byLeft),
    monthly: monthly.sort(byLeft),
    stopped: sum(days.map((day) => day.workersStopped)),
  };
}

function ofToday(
  today: DailyUsage | undefined,
  id: string,
  product: FreeLimit["product"],
  item: string,
  limit: number,
  of: (day: DailyUsage) => number,
  unit: FreeLimit["unit"] = "count",
): FreeLimit {
  const used = today === undefined ? 0 : of(today);
  return { id, product, item, used, limit, unit, left: 1 - used / limit };
}

function current(id: string, product: FreeLimit["product"], item: string, used: number, limit: number, unit: FreeLimit["unit"]): FreeLimit {
  return { id, product, item, used, limit, unit, left: 1 - used / limit };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
