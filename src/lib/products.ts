// The resources of each product in a day, with their values in the order that the
// charts and the tables of the product use them.

import type { DailyUsage } from "../../shared/usage.ts";
import type { ResourceValues } from "./series.ts";

/** Requests, then CPU time in milliseconds. */
export const workerValues: ResourceValues = (day) =>
  day.workers.map((item) => ({ key: item.scriptName, values: [item.requests, item.cpuTimeMs] }));

/** Rows read, rows written, then the size in bytes. */
export const d1Values: ResourceValues = (day) =>
  day.d1.map((item) => ({ key: item.databaseId, values: [item.rowsRead, item.rowsWritten, item.storageBytes] }));

/** Class A operations, Class B operations, then the size in bytes. */
export const r2Values: ResourceValues = (day) =>
  day.r2.map((item) => ({ key: item.bucketName, values: [item.classA, item.classB, item.storageBytes] }));

/** The name of an R2 bucket. Operations on the whole account, such as listing the buckets, have none. */
export function bucketLabel(name: string): string {
  return name === "" ? "(no bucket)" : name;
}

export interface ResourceTotals {
  key: string;
  /** Each value added up over the days. */
  sums: number[];
  /** Each value of the last day that has the resource, for sizes, which do not add up. */
  latest: number[];
}

/** Every resource of the days with its totals, in no particular order. */
export function totalsBy(days: DailyUsage[], values: ResourceValues): ResourceTotals[] {
  const totals = new Map<string, ResourceTotals>();
  for (const day of days) {
    for (const { key, values: dayValues } of values(day)) {
      const entry = totals.get(key) ?? { key, sums: dayValues.map(() => 0), latest: [] };
      dayValues.forEach((value, index) => {
        entry.sums[index] = (entry.sums[index] ?? 0) + value;
      });
      entry.latest = dayValues;
      totals.set(key, entry);
    }
  }
  return [...totals.values()];
}
