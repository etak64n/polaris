// The API of polestar. Every route answers only requests that Cloudflare Access
// let through, or requests to localhost under `cf dev`.

import { Hono } from "hono";
import {
  USAGE_DAYS_MAX,
  USAGE_DAYS_MIN,
  type ApiErrorBody,
  type QueryOrder,
  type TopQueriesResponse,
  type UsageResponse,
} from "../shared/api.ts";
import { addDays, datesBetween, monthOf, utcDate } from "../shared/dates.ts";
import { emptyDay, type DailyUsage } from "../shared/usage.ts";
import { AccessDeniedError, isLocalhost, verifyAccessToken, type KeySetProvider } from "./access.ts";
import { AnalyticsError, MAX_QUERY_DAYS, type UsageSource } from "./analytics.ts";
import type { JsonCache } from "./cache.ts";
import type { Env } from "./env.ts";
import { HistoryError, UsageHistory } from "./history.ts";
import { badRequest, HttpError, notFound } from "./http.ts";
import { errorFields, log } from "./log.ts";
import { ConfigurationError, readRuntimeConfig, type RuntimeConfig } from "./runtime-config.ts";

export interface AppDependencies {
  keySetFor: KeySetProvider;
  usageSourceFor: (config: RuntimeConfig) => UsageSource;
  /** The cache for one request. */
  cacheFor: () => JsonCache;
  now: () => Date;
}

/** Dates that come from Cloudflare analytics: today and the days before it that analytics still hold. */
export const LIVE_DAYS = MAX_QUERY_DAYS;

const USAGE_CACHE_SECONDS = 300;
const NAMES_CACHE_SECONDS = 3600;
const TOP_QUERY_COUNT = 20;
const TOP_QUERY_DAYS = [1, 7];

type AppEnv = { Bindings: Env; Variables: { config: RuntimeConfig; requestId: string } };

export function createApp(dependencies: AppDependencies) {
  const app = new Hono<AppEnv>();

  app.use("/api/*", async (c, next) => {
    c.set("requestId", crypto.randomUUID());
    const config = readRuntimeConfig(c.env);
    c.set("config", config);
    if (config.authMode === "local-development") {
      if (!isLocalhost(new URL(c.req.url))) {
        throw new AccessDeniedError("The local development mode answers only requests to localhost.");
      }
    } else {
      await verifyAccessToken(
        c.req.header("Cf-Access-Jwt-Assertion"),
        config.access,
        dependencies.keySetFor(config.access.teamDomain),
      );
    }
    await next();
  });

  app.get("/api/usage", async (c) => {
    const config = c.get("config");
    const dayCount = readWholeNumber(c.req.query("days"), "days", USAGE_DAYS_MIN, USAGE_DAYS_MAX);
    const today = utcDate(dependencies.now());
    const from = addDays(today, -(dayCount - 1));
    const liveFrom = addDays(today, -(LIVE_DAYS - 1));
    const source = dependencies.usageSourceFor(config);
    const cache = dependencies.cacheFor();

    const [live, recorded, databaseNames] = await Promise.all([
      cache.get(`usage/${config.accountId}/${liveFrom}/${today}`, USAGE_CACHE_SECONDS, () => source.dailyUsage(liveFrom, today)),
      from < liveFrom ? readRecorded(new UsageHistory(c.env.HISTORY), from, addDays(liveFrom, -1)) : Promise.resolve([]),
      cache.get(`d1-names/${config.accountId}`, NAMES_CACHE_SECONDS, () => source.databaseNames()),
    ]);
    const byDate = new Map([...recorded, ...live].map((day) => [day.date, day]));
    const body: UsageResponse = {
      plan: config.plan,
      cycleStartDay: config.cycleStartDay,
      today,
      days: datesBetween(from, today).map((date) => byDate.get(date) ?? emptyDay(date)),
      liveFrom,
      databaseNames,
    };
    return c.json(body);
  });

  app.get("/api/d1/top-queries", async (c) => {
    const config = c.get("config");
    const dayCount = readWholeNumber(c.req.query("days"), "days", 1, 7);
    if (!TOP_QUERY_DAYS.includes(dayCount)) throw badRequest(`days must be one of ${TOP_QUERY_DAYS.join(", ")}.`);
    const order = readOrder(c.req.query("order"));
    const today = utcDate(dependencies.now());
    const from = addDays(today, -(dayCount - 1));
    const queries = await dependencies.cacheFor().get(
      `top-queries/${config.accountId}/${from}/${today}/${order}`,
      USAGE_CACHE_SECONDS,
      () => dependencies.usageSourceFor(config).topQueries(from, today, order, TOP_QUERY_COUNT),
    );
    const body: TopQueriesResponse = { from, to: today, order, queries };
    return c.json(body);
  });

  app.all("/api/*", () => {
    throw notFound("There is no such API.");
  });

  app.onError((error, c) => {
    const { status, code } = statusOf(error);
    const requestId = c.get("requestId") ?? null;
    log(status >= 500 ? "ERROR" : "WARN", "The API request failed.", requestId, {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status,
      ...errorFields(error),
    });
    // Unexpected errors keep their details in the log, not in the response.
    const message = code === "internal" ? "The request failed. The Worker log has the details." : error.message;
    const body: ApiErrorBody = { error: { code, message } };
    return c.json(body, status);
  });

  return app;
}

function statusOf(error: Error): { status: 400 | 403 | 404 | 500 | 502; code: string } {
  if (error instanceof HttpError) return { status: error.status as 400 | 404, code: error.code };
  if (error instanceof AccessDeniedError) return { status: 403, code: "access_denied" };
  if (error instanceof AnalyticsError) return { status: 502, code: "analytics_unavailable" };
  if (error instanceof HistoryError) return { status: 500, code: "history_unreadable" };
  if (error instanceof ConfigurationError) return { status: 500, code: "configuration" };
  return { status: 500, code: "internal" };
}

/** Recorded days from `from` to `to`, both included. */
async function readRecorded(history: UsageHistory, from: string, to: string): Promise<DailyUsage[]> {
  const months = [...new Set(datesBetween(from, to).map(monthOf))];
  const files = await Promise.all(months.map((month) => history.read(month)));
  return files.flat().filter((day) => day.date >= from && day.date <= to);
}

function readWholeNumber(value: string | undefined, name: string, min: number, max: number): number {
  if (value === undefined) throw badRequest(`${name} is required.`);
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < min || number > max) {
    throw badRequest(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return number;
}

function readOrder(value: string | undefined): QueryOrder {
  if (value === "rowsRead" || value === "rowsWritten") return value;
  throw badRequest('order must be "rowsRead" or "rowsWritten".');
}
