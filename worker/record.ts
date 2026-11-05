// The daily job: copies the usage of the last complete days from Cloudflare
// analytics into the history bucket.

import { addDays, utcDate } from "../shared/dates.ts";
import type { UsageSource } from "./analytics.ts";
import type { UsageHistory } from "./history.ts";

/** How many complete days each run records. Analytics keep about 31 days, so a missed run heals the next day. */
export const RECORDED_DAYS = 30;

export interface RecordResult {
  from: string;
  to: string;
  months: string[];
}

export async function recordHistory(source: UsageSource, history: UsageHistory, now: Date): Promise<RecordResult> {
  const today = utcDate(now);
  const to = addDays(today, -1);
  const from = addDays(today, -RECORDED_DAYS);
  const days = await source.dailyUsage(from, to);
  const months = await history.record(days);
  return { from, to, months };
}
