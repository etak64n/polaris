// Shapes of the JSON that the Worker API returns.

import type { PlanType } from "./plan.ts";
import type { DailyUsage } from "./usage.ts";

/** The days that /api/usage returns: today and the days before it, which cover the current billing cycle. */
export const USAGE_DAYS = 31;

export interface UsageResponse {
  plan: PlanType;
  /** The day of the month on which the billing cycle starts. */
  cycleStartDay: number;
  /** Today in UTC. Its usage is still growing. */
  today: string;
  /** The last USAGE_DAYS dates, oldest first. A day without usage has no resources. */
  days: DailyUsage[];
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

/** The most databases that a request for top queries can narrow the queries to. */
export const TOP_QUERY_DATABASES_MAX = 5;

export interface TopQueriesResponse {
  /** First and last UTC date of the queries. */
  from: string;
  to: string;
  order: QueryOrder;
  queries: TopQuery[];
}

/** The person who signed in through Cloudflare Access, and how and when they signed in. */
export interface Me {
  email: string;
  /** The type of the login method, such as passkeys, onetimepin, or github. */
  method: string;
  /** When the person signed in. */
  signedInAt: string;
  /** Where to send the browser to sign out. */
  logoutUrl: string;
}

export interface MeResponse {
  /** null under `cf dev`, where Access does not run and nobody signs in. */
  me: Me | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
