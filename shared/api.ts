// Shapes of the JSON that the Worker API returns.

import type { PlanType } from "./plan.ts";
import type { DailyUsage } from "./usage.ts";

/** The days that /api/usage returns: today and the days before it, which cover the current billing cycle. */
export const USAGE_DAYS = 31;

export interface UsageResponse {
  plan: PlanType;
  /** The day of the month on which the billing cycle starts. */
  cycleStartDay: number;
  /** Whether the charts draw a line at the limits of the Free plan, from the settings. */
  freeLimitLines: boolean;
  /** Today in UTC. Its usage is still growing. */
  today: string;
  /** The last USAGE_DAYS dates, oldest first. A day without usage has no resources. */
  days: DailyUsage[];
  /** D1 database names by database ID. Deleted databases have no name. */
  databaseNames: Record<string, string>;
  /** The Cron Triggers of all the Workers of the account now. */
  cronTriggers: number;
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

/** The invocations of one handler of one Worker, such as its fetch or cron handler, and their CPU time. */
export interface WorkerHandler {
  scriptName: string;
  /** The handler as Cloudflare analytics names it, such as fetch, cron, or queue. */
  handler: string;
  invocations: number;
  /** CPU time of all the invocations, in milliseconds. */
  cpuTimeMs: number;
  /** CPU time of one invocation at the 50th and the 99th percentile, in milliseconds. */
  cpuTimeP50Ms: number;
  cpuTimeP99Ms: number;
}

export interface WorkerHandlersResponse {
  /** First and last UTC date of the invocations. */
  from: string;
  to: string;
  /** The handlers with the most CPU time first. */
  handlers: WorkerHandler[];
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
