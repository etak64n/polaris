// The API of polaris. Every route answers only requests that Cloudflare Access
// let through, or requests to localhost under `cf dev`.

import { Hono } from "hono";
import {
  TOP_QUERY_DATABASES_MAX,
  USAGE_DAYS,
  type ApiErrorBody,
  type QueryOrder,
  type TopQueriesResponse,
  type UsageResponse,
} from "../shared/api.ts";
import { addDays, datesBetween, utcDate } from "../shared/dates.ts";
import {
  MAX_PICKED_RESOURCES,
  METRIC_RANGES,
  refreshSeconds,
  type MetricProduct,
  type MetricRange,
  type MetricsResponse,
} from "../shared/metrics.ts";
import { emptyDay } from "../shared/usage.ts";
import { AccessDeniedError, isLocalhost, verifyAccessToken, type KeySetProvider } from "./access.ts";
import { AnalyticsError, type UsageSource } from "./analytics.ts";
import type { JsonCache } from "./cache.ts";
import type { Env } from "./env.ts";
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

const USAGE_CACHE_SECONDS = 300;
/**
 * The shape of the cached days. It changes with DailyUsage, so a newly deployed
 * Worker never reads days that an older one cached in another shape.
 */
const USAGE_SHAPE = "v2";
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
    if (config.auth.mode === "local-development") {
      if (!isLocalhost(new URL(c.req.url))) {
        throw new AccessDeniedError("The local development mode answers only requests to localhost.");
      }
    } else {
      await verifyAccessToken(c.req.header("Cf-Access-Jwt-Assertion"), config.auth, dependencies.keySetFor(config.auth.teamDomain));
    }
    await next();
  });

  app.get("/api/usage", async (c) => {
    const config = c.get("config");
    const today = utcDate(dependencies.now());
    const from = addDays(today, -(USAGE_DAYS - 1));
    const source = dependencies.usageSourceFor(config);
    const cache = dependencies.cacheFor();

    const [days, databaseNames] = await Promise.all([
      cache.get(`usage/${USAGE_SHAPE}/${config.accountId}/${from}/${today}`, USAGE_CACHE_SECONDS, () => source.dailyUsage(from, today)),
      cache.get(`d1-names/${config.accountId}`, NAMES_CACHE_SECONDS, () => source.databaseNames()),
    ]);
    const byDate = new Map(days.map((day) => [day.date, day]));
    const body: UsageResponse = {
      plan: config.plan,
      cycleStartDay: config.cycleStartDay,
      today,
      days: datesBetween(from, today).map((date) => byDate.get(date) ?? emptyDay(date)),
      databaseNames,
    };
    return c.json(body);
  });

  app.get("/api/metrics", async (c) => {
    const config = c.get("config");
    const product = readProduct(c.req.query("product"));
    const range = readRange(c.req.query("range"));
    const picked = readPicked(product, c.req.queries("resource"));
    const now = dependencies.now();
    const source = dependencies.usageSourceFor(config);
    const cache = dependencies.cacheFor();
    const seconds = refreshSeconds(range);
    // One key per cache lifetime, so a cached answer never outlives its periods.
    const slot = Math.floor(now.getTime() / (seconds * 1000));
    const [metrics, names] = await Promise.all([
      cache.get(`metrics/${config.accountId}/${product}/${range}/${picked.join(",")}/${slot}`, seconds, () =>
        source.metrics(product, range, picked, now),
      ),
      product === "d1"
        ? cache.get(`d1-names/${config.accountId}`, NAMES_CACHE_SECONDS, () => source.databaseNames())
        : Promise.resolve<Record<string, string>>({}),
    ]);
    const body: MetricsResponse = { ...metrics, names };
    return c.json(body);
  });

  app.get("/api/d1/top-queries", async (c) => {
    const config = c.get("config");
    const dayCount = readWholeNumber(c.req.query("days"), "days", 1, 7);
    if (!TOP_QUERY_DAYS.includes(dayCount)) throw badRequest(`days must be one of ${TOP_QUERY_DAYS.join(", ")}.`);
    const order = readOrder(c.req.query("order"));
    const databaseIds = readDatabaseIds(c.req.queries("database"));
    const today = utcDate(dependencies.now());
    const from = addDays(today, -(dayCount - 1));
    const queries = await dependencies.cacheFor().get(
      `top-queries/${config.accountId}/${from}/${today}/${order}/${databaseIds.join(",")}`,
      USAGE_CACHE_SECONDS,
      () => dependencies.usageSourceFor(config).topQueries(from, today, order, TOP_QUERY_COUNT, databaseIds),
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
  if (error instanceof ConfigurationError) return { status: 500, code: "configuration" };
  return { status: 500, code: "internal" };
}

function readWholeNumber(value: string | undefined, name: string, min: number, max: number): number {
  if (value === undefined) throw badRequest(`${name} is required.`);
  const number = Number(value);
  if (!/^\d+$/.test(value) || number < min || number > max) {
    throw badRequest(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return number;
}

// D1 database IDs are UUIDs.
const DATABASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The databases that the top queries come from, sorted, or none for every database. */
function readDatabaseIds(values: string[] | undefined): string[] {
  const ids = [...new Set(values ?? [])].sort();
  if (ids.length > TOP_QUERY_DATABASES_MAX) throw badRequest(`database can be given at most ${TOP_QUERY_DATABASES_MAX} times.`);
  if (!ids.every((id) => DATABASE_ID.test(id))) throw badRequest("database must be the ID of a D1 database.");
  return ids;
}

function readProduct(value: string | undefined): MetricProduct {
  if (value === "workers" || value === "d1" || value === "r2") return value;
  throw badRequest('product must be "workers", "d1", or "r2".');
}

function readRange(value: string | undefined): MetricRange {
  const range = METRIC_RANGES.find((item) => item === value);
  if (range === undefined) throw badRequest(`range must be one of ${METRIC_RANGES.join(", ")}.`);
  return range;
}

// The forms of the resources of each product. R2 operations on the whole account have no bucket name.
const RESOURCE_KEY: Record<MetricProduct, RegExp> = {
  workers: /^[A-Za-z0-9_-]{1,63}$/,
  d1: DATABASE_ID,
  r2: /^(?:|[a-z0-9][a-z0-9-]{1,61}[a-z0-9])$/,
};

/** The picked resources, without repeats, in the order given. */
function readPicked(product: MetricProduct, values: string[] | undefined): string[] {
  const picked = [...new Set(values ?? [])];
  if (picked.length > MAX_PICKED_RESOURCES) throw badRequest(`resource can be given at most ${MAX_PICKED_RESOURCES} times.`);
  if (!picked.every((key) => RESOURCE_KEY[product].test(key))) throw badRequest(`resource must name a resource of ${product}.`);
  return picked;
}

function readOrder(value: string | undefined): QueryOrder {
  if (value === "rowsRead" || value === "rowsWritten") return value;
  throw badRequest('order must be "rowsRead" or "rowsWritten".');
}
