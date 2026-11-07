// The API of polaris. Every route answers only requests that Cloudflare Access
// let through, or requests to localhost under `cf dev`.

import { Hono } from "hono";
import {
  TOP_QUERY_DATABASES_MAX,
  USAGE_DAYS,
  type ApiErrorBody,
  type MeResponse,
  type QueryOrder,
  type TopQueriesResponse,
  type UsageResponse,
  type WorkerHandlersResponse,
} from "../shared/api.ts";
import { addDays, datesBetween, utcDate } from "../shared/dates.ts";
import {
  MAX_PICKED_RESOURCES,
  METRIC_PRODUCTS,
  METRIC_RANGES,
  refreshSeconds,
  type MetricProduct,
  type MetricRange,
  type MetricsResponse,
} from "../shared/metrics.ts";
import { emptyDay } from "../shared/usage.ts";
import {
  AccessDeniedError,
  AccessIdentityError,
  isLocalhost,
  readSignIn,
  verifyAccessToken,
  type IdentityFetcher,
  type KeySetProvider,
} from "./access.ts";
import { AnalyticsError, isNamedProduct, type UsageSource } from "./analytics.ts";
import type { JsonCache } from "./cache.ts";
import type { Env } from "./env.ts";
import { badRequest, HttpError, notFound } from "./http.ts";
import { errorFields, log } from "./log.ts";
import { ConfigurationError, readRuntimeConfig, type RuntimeConfig } from "./runtime-config.ts";

export interface AppDependencies {
  keySetFor: KeySetProvider;
  /** Asks Access for the full identity of the session behind a token. */
  fetchIdentity: IdentityFetcher;
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
const USAGE_SHAPE = "v3";
const NAMES_CACHE_SECONDS = 3600;
const TOP_QUERY_COUNT = 20;
/**
 * The most Workers whose Cron Triggers /api/usage asks for, one subrequest each. A Worker
 * on the Free plan may send 50 subrequests in a request, and /api/usage needs a few more
 * for the usage, the names of the databases, the list of the Workers, and the
 * subscriptions. Workers Paid allows 10,000.
 */
const CRON_LOOKUPS = { free: 40, paid: 1_000 } as const;
const WORKER_HANDLER_COUNT = 50;
// The periods of the top queries and of the handlers of the Workers: today and the last 7 days.
const RECENT_DAYS = [1, 7];
// Access serves this path on every domain that it protects. It ends the session of the person.
const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

/** email is the email in the Access token, and null under `cf dev` or for a service token. */
type AppEnv = { Bindings: Env; Variables: { config: RuntimeConfig; requestId: string; email: string | null } };

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
      c.set("email", null);
    } else {
      const identity = await verifyAccessToken(c.req.header("Cf-Access-Jwt-Assertion"), config.auth, dependencies.keySetFor(config.auth.teamDomain));
      c.set("email", identity.email);
    }
    await next();
  });

  // Who signed in, how, and when, for the account menu. The token holds the email but not
  // the login method, so the Worker asks Access for the identity of the session.
  app.get("/api/me", async (c) => {
    const config = c.get("config");
    if (config.auth.mode === "local-development") {
      const body: MeResponse = { me: null };
      return c.json(body);
    }
    const email = c.get("email");
    if (email === null) throw new AccessDeniedError("The Cloudflare Access token names no person, as the token of a service does.");
    let identity: unknown;
    try {
      identity = await dependencies.fetchIdentity(config.auth.teamDomain, c.req.header("Cf-Access-Jwt-Assertion") ?? "");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new AccessIdentityError(`polaris could not read the identity of the session from Cloudflare Access: ${reason}`);
    }
    const signIn = readSignIn(identity);
    if (signIn === null) {
      throw new AccessIdentityError("Cloudflare Access answered an identity without the login method or the time of the sign-in.");
    }
    const body: MeResponse = { me: { email, ...signIn, logoutUrl: ACCESS_LOGOUT_PATH } };
    return c.json(body);
  });

  app.get("/api/usage", async (c) => {
    const config = c.get("config");
    const today = utcDate(dependencies.now());
    const from = addDays(today, -(USAGE_DAYS - 1));
    const source = dependencies.usageSourceFor(config);
    const cache = dependencies.cacheFor();

    const [days, databaseNames, cronTriggers, subscriptions] = await Promise.all([
      cache.get(`usage/${USAGE_SHAPE}/${config.accountId}/${from}/${today}`, USAGE_CACHE_SECONDS, () => source.dailyUsage(from, today)),
      cache.get(`d1-names/${config.accountId}`, NAMES_CACHE_SECONDS, () => source.databaseNames()),
      cache.get(`cron-triggers/${config.accountId}`, USAGE_CACHE_SECONDS, () => source.cronTriggers(CRON_LOOKUPS[config.plan])),
      cache.get(`subscriptions/${config.accountId}`, USAGE_CACHE_SECONDS, () => source.subscriptions()),
    ]);
    const byDate = new Map(days.map((day) => [day.date, day]));
    const body: UsageResponse = {
      plan: config.plan,
      cycleStartDay: config.cycleStartDay,
      freeLimitLines: config.freeLimitLines,
      today,
      days: datesBetween(from, today).map((date) => byDate.get(date) ?? emptyDay(date)),
      databaseNames,
      cronTriggers,
      subscriptions,
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
        : isNamedProduct(product)
          ? cache.get(`names/${config.accountId}/${product}`, NAMES_CACHE_SECONDS, () => source.resourceNames(product))
          : Promise.resolve<Record<string, string>>({}),
    ]);
    const body: MetricsResponse = { ...metrics, names };
    return c.json(body);
  });

  app.get("/api/d1/top-queries", async (c) => {
    const config = c.get("config");
    const dayCount = readWholeNumber(c.req.query("days"), "days", 1, 7);
    if (!RECENT_DAYS.includes(dayCount)) throw badRequest(`days must be one of ${RECENT_DAYS.join(", ")}.`);
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

  app.get("/api/workers/handlers", async (c) => {
    const config = c.get("config");
    const dayCount = readWholeNumber(c.req.query("days"), "days", 1, 7);
    if (!RECENT_DAYS.includes(dayCount)) throw badRequest(`days must be one of ${RECENT_DAYS.join(", ")}.`);
    const scriptNames = readWorkerNames(c.req.queries("worker"));
    const today = utcDate(dependencies.now());
    const from = addDays(today, -(dayCount - 1));
    const handlers = await dependencies.cacheFor().get(
      `worker-handlers/${config.accountId}/${from}/${today}/${scriptNames.join(",")}`,
      USAGE_CACHE_SECONDS,
      () => dependencies.usageSourceFor(config).workerHandlers(from, today, WORKER_HANDLER_COUNT, scriptNames),
    );
    const body: WorkerHandlersResponse = { from, to: today, handlers };
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
  if (error instanceof AccessIdentityError) return { status: 502, code: "access_unavailable" };
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

/** The Workers that the handlers come from, sorted, or none for every Worker. */
function readWorkerNames(values: string[] | undefined): string[] {
  const names = [...new Set(values ?? [])].sort();
  if (names.length > MAX_PICKED_RESOURCES) throw badRequest(`worker can be given at most ${MAX_PICKED_RESOURCES} times.`);
  if (!names.every((name) => RESOURCE_KEY.workers.test(name))) throw badRequest("worker must be the name of a Worker.");
  return names;
}

function readProduct(value: string | undefined): MetricProduct {
  const product = METRIC_PRODUCTS.find((item) => item === value);
  if (product === undefined) throw badRequest(`product must be one of ${METRIC_PRODUCTS.join(", ")}.`);
  return product;
}

function readRange(value: string | undefined): MetricRange {
  const range = METRIC_RANGES.find((item) => item === value);
  if (range === undefined) throw badRequest(`range must be one of ${METRIC_RANGES.join(", ")}.`);
  return range;
}

// The forms of the resources of each product. R2 operations on the whole account have no
// bucket name, and Browser Run has no resource but the account. The analytics write some
// IDs as 32 hexadecimal digits and others as UUIDs, as KV does for its namespaces.
const HEX_ID = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const RESOURCE_KEY: Record<MetricProduct, RegExp> = {
  workers: /^[A-Za-z0-9_-]{1,63}$/,
  durableObjects: HEX_ID,
  queues: HEX_ID,
  workflows: /^[A-Za-z0-9_-]{1,64}$/,
  browserRun: /^$/,
  d1: DATABASE_ID,
  r2: /^(?:|[a-z0-9][a-z0-9-]{1,61}[a-z0-9])$/,
  kv: HEX_ID,
  hyperdrive: HEX_ID,
  workersAi: /^@?[A-Za-z0-9._:/-]{1,200}$/,
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
