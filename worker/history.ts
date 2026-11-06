// The history bucket: the daily usage after Cloudflare analytics stop holding it.
//
// Each month is one JSON file, daily/YYYY-MM.json, that the Worker rewrites
// once a day while the month lasts. Analytics keep about 31 days, so the
// Worker records the last 30 complete days every time: a day that one run
// missed is recorded by the next.

import { monthOf } from "../shared/dates.ts";
import type { DailyUsage } from "../shared/usage.ts";
import type { R2Bucket } from "./env.ts";

export const HISTORY_FORMAT = 1;

export interface MonthFile {
  format: typeof HISTORY_FORMAT;
  month: string;
  /** Days of the month, oldest first. */
  days: DailyUsage[];
}

export class HistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoryError";
  }
}

export function monthKey(month: string): string {
  return `daily/${month}.json`;
}

export class UsageHistory {
  readonly #bucket: R2Bucket;

  constructor(bucket: R2Bucket) {
    this.#bucket = bucket;
  }

  /** The recorded days of a month, oldest first. A month without a file has no days. */
  async read(month: string): Promise<DailyUsage[]> {
    const object = await this.#bucket.get(monthKey(month));
    if (object === null) return [];
    let file: Partial<MonthFile>;
    try {
      file = JSON.parse(await object.text()) as Partial<MonthFile>;
    } catch {
      throw new HistoryError(`${monthKey(month)} in the history bucket is not JSON.`);
    }
    if (file.format !== HISTORY_FORMAT || file.month !== month || !Array.isArray(file.days)) {
      throw new HistoryError(`${monthKey(month)} in the history bucket is not a polaris history file of format ${HISTORY_FORMAT}.`);
    }
    return file.days;
  }

  async write(month: string, days: DailyUsage[]): Promise<void> {
    const file: MonthFile = { format: HISTORY_FORMAT, month, days };
    await this.#bucket.put(monthKey(month), JSON.stringify(file), { httpMetadata: { contentType: "application/json" } });
  }

  /** Records days, replacing the recorded days of the same dates. Returns the months that it wrote. */
  async record(days: DailyUsage[]): Promise<string[]> {
    const byMonth = new Map<string, DailyUsage[]>();
    for (const day of days) {
      const month = monthOf(day.date);
      byMonth.set(month, [...(byMonth.get(month) ?? []), day]);
    }
    const months = [...byMonth.keys()].sort();
    for (const month of months) {
      const recorded = await this.read(month);
      await this.write(month, mergeDays(recorded, byMonth.get(month) ?? []));
    }
    return months;
  }
}

/** Days of both lists, oldest first. A day in `incoming` replaces the day of the same date in `recorded`. */
export function mergeDays(recorded: DailyUsage[], incoming: DailyUsage[]): DailyUsage[] {
  const byDate = new Map(recorded.map((day) => [day.date, day]));
  for (const day of incoming) byDate.set(day.date, day);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
