// Shapes of the JSON that the Worker API returns.

import type { PlanType } from "./plan.ts";
import type { DailyUsage } from "./usage.ts";

/** The fewest days that /api/usage returns: always the whole current billing cycle. */
export const USAGE_DAYS_MIN = 31;
/** The most days that /api/usage returns. */
export const USAGE_DAYS_MAX = 400;

export interface UsageResponse {
  plan: PlanType;
  /** The day of the month on which the billing cycle starts. */
  cycleStartDay: number;
  /** Today in UTC. Its usage is still growing. */
  today: string;
  /** Every date of the range, oldest first. A day without usage has no resources. */
  days: DailyUsage[];
  /** The first date that comes from Cloudflare analytics. Older dates come from the history bucket. */
  liveFrom: string;
  /** D1 database names by database ID. Deleted databases have no name. */
  databaseNames: Record<string, string>;
}

export type QueryOrder = "rowsRead" | "rowsWritten";

export interface TopQuery {
  databaseId: string;
  /** The SQL text, without the bound values. */
  query: string;
  runs: number;
  rowsRead: number;
  rowsWritten: number;
  /** Time that the database spent on the query in all runs, in milliseconds. */
  durationMs: number;
}

export interface TopQueriesResponse {
  /** First and last UTC date of the queries. */
  from: string;
  to: string;
  order: QueryOrder;
  queries: TopQuery[];
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
