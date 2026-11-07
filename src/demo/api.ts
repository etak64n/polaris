// Answers of the polaris API for the demo on GitHub Pages. They describe a small,
// made-up account on the Free plan, computed in the browser from the current time, so
// that the demo shows the real screens without a Worker, Cloudflare Access, or the
// usage of a real account. Only the demo build imports this file (src/api.ts).

import {
  USAGE_DAYS,
  type MeResponse,
  type QueryOrder,
  type SettingsResponse,
  type TopQueriesResponse,
  type TopQuery,
  type UsageResponse,
  type WorkerHandler,
  type WorkerHandlersResponse,
} from "../../shared/api.ts";
import { addDays, datesBetween, utcDate } from "../../shared/dates.ts";
import {
  MAX_PICKED_RESOURCES,
  METRIC_PRODUCTS,
  METRIC_RANGES,
  OTHER_SERIES,
  PERIOD_SECONDS,
  PRODUCT_METRICS,
  RANGE_SPECS,
  type MetricProduct,
  type MetricRange,
  type MetricResource,
  type MetricsResponse,
} from "../../shared/metrics.ts";
import { emptyDay, type DailyUsage } from "../../shared/usage.ts";

const DAY_MS = 86_400_000;
const MB = 1_000_000;
const GB = 1_000_000_000;

/** A number from 0 to 1 that is always the same for the same seed. */
function noise(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

/** A factor around 1, within ± spread, that is always the same for the same seed. */
function jitter(seed: string, spread: number): number {
  return 1 + (noise(seed) - 0.5) * 2 * spread;
}

/** More traffic in the afternoon UTC and less on weekends. */
function activity(time: Date): number {
  const hour = time.getUTCHours() + time.getUTCMinutes() / 60;
  const daily = 0.6 + 0.4 * Math.sin(((hour - 8) / 24) * 2 * Math.PI);
  const weekday = time.getUTCDay();
  return daily * (weekday === 0 || weekday === 6 ? 0.75 : 1);
}

// The resources of the account. Daily amounts are on a weekday, before the jitter.
const WORKERS = [
  { name: "web", requests: 27_000, cpuMsPerRequest: 4.2 },
  { name: "api", requests: 18_000, cpuMsPerRequest: 6.8 },
  { name: "image-resizer", requests: 5_200, cpuMsPerRequest: 38 },
  { name: "auth", requests: 4_600, cpuMsPerRequest: 3.1 },
  { name: "webhooks", requests: 2_300, cpuMsPerRequest: 5.5 },
  { name: "cron-jobs", requests: 1_400, cpuMsPerRequest: 120 },
];
const DATABASES = [
  { id: "3f0c8a1e-6d2b-4c71-9a54-2b8e7d1f6c03", name: "app", rowsRead: 1_900_000, rowsWritten: 26_000, bytes: 182 * MB },
  { id: "9b2e4d17-3a6f-4e58-8c19-7d05f2a6b4e1", name: "analytics", rowsRead: 1_150_000, rowsWritten: 11_000, bytes: 412 * MB },
  { id: "c71a5e30-8f42-4b9d-a6e3-15c9d0b7f284", name: "sessions", rowsRead: 260_000, rowsWritten: 4_200, bytes: 24 * MB },
];
const BUCKETS = [
  { name: "assets", classA: 1_800, classB: 96_000, bytes: 3.2 * GB, objects: 41_000 },
  { name: "backups", classA: 5_600, classB: 900, bytes: 2.4 * GB, objects: 730 },
  { name: "uploads", classA: 1_500, classB: 21_000, bytes: 0.9 * GB, objects: 12_400 },
];
const KV_NAMESPACES = [
  { id: "5d1e7f20a4b94c6e8f3a1b2c9d0e4f57", name: "CACHE", reads: 24_000, writes: 220, deletes: 30, lists: 40, bytes: 38 * MB, keys: 9_200 },
  { id: "a29c4e6b8d1f40e3b7a5c2d9e8f1b046", name: "SESSIONS", reads: 13_000, writes: 140, deletes: 15, lists: 10, bytes: 6 * MB, keys: 3_100 },
  { id: "e8b3f1c5a7d240968c1e5f3b2a9d7c60", name: "CONFIG", reads: 4_100, writes: 6, deletes: 0, lists: 70, bytes: 0.2 * MB, keys: 42 },
];
const DURABLE_OBJECTS = [
  { id: "7c2a9e41b5d34f80a6e1c3b7d9f2e054", name: "ChatRoom", requests: 14_000, gbSeconds: 1_600, rowsRead: 280_000, rowsWritten: 12_000, bytes: 190 * MB },
  { id: "b4f8d2a6c0e14b37918a5d3c7e2f6b19", name: "RateLimiter", requests: 7_400, gbSeconds: 800, rowsRead: 130_000, rowsWritten: 6_000, bytes: 70 * MB },
];
const QUEUES = [
  { id: "2e9b7d4f1a6c48e3b5d0c7a9f3e1b862", name: "emails", operations: 1_500, backlog: 12 },
  { id: "f1c6a3e8d5b24097a4e2b9c7d1f0a538", name: "thumbnails", operations: 1_100, backlog: 30 },
];
const WORKFLOWS = [
  { name: "onboarding", steps: 420, cpuMs: 9_000, retries: 6 },
  { name: "nightly-report", steps: 220, cpuMs: 14_000, retries: 2 },
];
const HYPERDRIVE = [{ id: "0d4b8f2e6a1c49b7a3e5d9c1f7b2e604", name: "postgres-main", queries: 12_000, errors: 14 }];
const AI_MODELS = [
  { name: "@cf/meta/llama-3.1-8b-instruct", neurons: 3_100, requests: 260 },
  { name: "@cf/baai/bge-base-en-v1.5", neurons: 700, requests: 1_900 },
];
const BROWSER_RUN = { browserMs: 156_000, sessions: 18 };
const PAGES_FUNCTIONS_REQUESTS = 1_200;

/** Usage of one day, scaled by how much of the day has passed. Older days are a little smaller. */
function dayUsage(date: string, share: number, today: string): DailyUsage {
  const daysAgo = Math.round((Date.parse(today) - Date.parse(date)) / DAY_MS);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const scale = share * (weekday === 0 || weekday === 6 ? 0.75 : 1) * (1 - daysAgo * 0.006);
  const amount = (value: number, seed: string) => Math.round(value * scale * jitter(`${date}/${seed}`, 0.12));
  const growth = 1 - daysAgo * 0.003;
  return {
    ...emptyDay(date),
    workers: WORKERS.map((worker) => {
      const requests = amount(worker.requests, worker.name);
      return { scriptName: worker.name, requests, cpuTimeMs: Math.round(requests * worker.cpuMsPerRequest) };
    }),
    pagesFunctionsRequests: amount(PAGES_FUNCTIONS_REQUESTS, "pages"),
    d1: DATABASES.map((database) => ({
      databaseId: database.id,
      rowsRead: amount(database.rowsRead, `${database.id}/read`),
      rowsWritten: amount(database.rowsWritten, `${database.id}/write`),
      storageBytes: Math.round(database.bytes * growth),
    })),
    r2: BUCKETS.map((bucket) => ({
      bucketName: bucket.name,
      classA: amount(bucket.classA, `${bucket.name}/a`),
      classB: amount(bucket.classB, `${bucket.name}/b`),
      storageBytes: Math.round(bucket.bytes * growth),
    })),
    kv: {
      reads: KV_NAMESPACES.reduce((total, kv) => total + amount(kv.reads, `${kv.id}/reads`), 0),
      writes: KV_NAMESPACES.reduce((total, kv) => total + amount(kv.writes, `${kv.id}/writes`), 0),
      deletes: KV_NAMESPACES.reduce((total, kv) => total + amount(kv.deletes, `${kv.id}/deletes`), 0),
      lists: KV_NAMESPACES.reduce((total, kv) => total + amount(kv.lists, `${kv.id}/lists`), 0),
    },
    durableObjects: {
      requests: DURABLE_OBJECTS.reduce((total, item) => total + amount(item.requests, `${item.id}/requests`), 0),
      gbSeconds: DURABLE_OBJECTS.reduce((total, item) => total + amount(item.gbSeconds, `${item.id}/gbs`), 0),
      rowsRead: DURABLE_OBJECTS.reduce((total, item) => total + amount(item.rowsRead, `${item.id}/read`), 0),
      rowsWritten: DURABLE_OBJECTS.reduce((total, item) => total + amount(item.rowsWritten, `${item.id}/write`), 0),
      storageBytes: Math.round(DURABLE_OBJECTS.reduce((total, item) => total + item.bytes, 0) * growth),
    },
    queuesOperations: QUEUES.reduce((total, queue) => total + amount(queue.operations, queue.id), 0),
    workersAiNeurons: AI_MODELS.reduce((total, model) => total + amount(model.neurons, model.name), 0),
    hyperdriveQueries: HYPERDRIVE.reduce((total, config) => total + amount(config.queries, config.id), 0),
    browserRunMs: amount(BROWSER_RUN.browserMs, "browser"),
    workflowsSteps: WORKFLOWS.reduce((total, workflow) => total + amount(workflow.steps, workflow.name), 0),
  };
}

function settings(now: Date): SettingsResponse {
  return { plan: "free", cycleStartDay: 1, freeLimitLines: true, today: utcDate(now) };
}

function usage(now: Date): UsageResponse {
  const today = utcDate(now);
  const todayShare = (now.getTime() - Date.parse(`${today}T00:00:00Z`)) / DAY_MS;
  return {
    ...settings(now),
    days: datesBetween(addDays(today, -(USAGE_DAYS - 1)), today).map((date) => dayUsage(date, date === today ? todayShare : 1, today)),
    databaseNames: Object.fromEntries(DATABASES.map((database) => [database.id, database.name])),
    cronTriggers: 2,
    subscriptions: demoSubscriptions(today),
  };
}

/** The plans that a small account on the Free plan has: Zero Trust for Access, and R2. */
function demoSubscriptions(today: string): UsageResponse["subscriptions"] {
  const start = `${today.slice(0, 8)}01`;
  const next = addDays(start, 32).slice(0, 8);
  const period = { periodStart: `${start}T00:00:00Z`, periodEnd: `${next}01T00:00:00Z` };
  return [
    { product: "Teams Free Base", price: 0, currency: "USD", frequency: "monthly", state: "Paid", ...period },
    { product: "R2 Paid", price: 0, currency: "USD", frequency: "monthly", state: "Paid", ...period },
  ];
}

/** A resource of a product: its key, its daily amount of each sum metric, its gauges, and its quantiles. */
interface DemoResource {
  key: string;
  sums: Record<string, number>;
  gauges: Record<string, number>;
}

function resourcesOf(product: MetricProduct): DemoResource[] {
  switch (product) {
    case "workers":
      return WORKERS.map((w) => ({
        key: w.name,
        sums: { requests: w.requests, errors: Math.round(w.requests * 0.004), subrequests: Math.round(w.requests * 1.6), cpuTimeMs: w.requests * w.cpuMsPerRequest },
        gauges: {},
      }));
    case "durableObjects":
      return DURABLE_OBJECTS.map((d) => ({
        key: d.id,
        sums: { requests: d.requests, errors: Math.round(d.requests * 0.002), gbSeconds: d.gbSeconds, rowsRead: d.rowsRead, rowsWritten: d.rowsWritten },
        gauges: { storageBytes: d.bytes },
      }));
    case "queues":
      return QUEUES.map((q) => ({ key: q.id, sums: { operations: q.operations }, gauges: { backlog: q.backlog } }));
    case "workflows":
      return WORKFLOWS.map((w) => ({ key: w.name, sums: { steps: w.steps, cpuTimeMs: w.cpuMs, retries: w.retries }, gauges: {} }));
    case "browserRun":
      // Browser time has no resource of its own: the whole account is one series.
      return [{ key: "", sums: { browserMs: BROWSER_RUN.browserMs, sessions: BROWSER_RUN.sessions }, gauges: {} }];
    case "d1":
      return DATABASES.map((d) => ({
        key: d.id,
        sums: { rowsRead: d.rowsRead, rowsWritten: d.rowsWritten, readQueries: Math.round(d.rowsRead / 18), writeQueries: Math.round(d.rowsWritten / 1.4) },
        gauges: { storageBytes: d.bytes },
      }));
    case "r2":
      return BUCKETS.map((b) => ({ key: b.name, sums: { classA: b.classA, classB: b.classB }, gauges: { storageBytes: b.bytes, objects: b.objects } }));
    case "kv":
      return KV_NAMESPACES.map((k) => ({
        key: k.id,
        sums: { reads: k.reads, writes: k.writes, deletes: k.deletes, lists: k.lists },
        gauges: { storageBytes: k.bytes, keys: k.keys },
      }));
    case "hyperdrive":
      return HYPERDRIVE.map((h) => ({ key: h.id, sums: { queries: h.queries, errors: h.errors }, gauges: {} }));
    case "workersAi":
      return AI_MODELS.map((m) => ({ key: m.name, sums: { neurons: m.neurons, requests: m.requests }, gauges: {} }));
  }
}

/** The names of the resources that have IDs, as the Cloudflare API reports them. */
function namesOf(product: MetricProduct): Record<string, string> {
  const pairs: { id: string; name: string }[] =
    product === "d1"
      ? DATABASES
      : product === "kv"
        ? KV_NAMESPACES
        : product === "durableObjects"
          ? DURABLE_OBJECTS
          : product === "queues"
            ? QUEUES
            : product === "hyperdrive"
              ? HYPERDRIVE
              : [];
  return Object.fromEntries(pairs.map((pair) => [pair.id, pair.name]));
}

/** The p50 and p99 of each quantile metric, in milliseconds. */
const QUANTILES: Partial<Record<MetricProduct, Record<string, { p50: number; p99: number }>>> = {
  workers: { cpuTimeMs: { p50: 3.4, p99: 41 }, wallTimeMs: { p50: 48, p99: 420 } },
  d1: { queryTimeMs: { p50: 0.4, p99: 6.2 } },
  kv: { latencyMs: { p50: 8, p99: 46 } },
};

/** The rank of a resource, as the Worker ranks them: the largest first by the metric that matters most. */
const RANK_METRIC: Record<MetricProduct, string> = {
  workers: "requests",
  durableObjects: "requests",
  queues: "operations",
  workflows: "steps",
  browserRun: "browserMs",
  d1: "rowsRead",
  r2: "storageBytes",
  kv: "reads",
  hyperdrive: "queries",
  workersAi: "neurons",
};

// Workflows, Browser Run, Hyperdrive, and Workers AI keep 31 days of analytics.
const SHORT_RETENTION: readonly MetricProduct[] = ["workflows", "browserRun", "hyperdrive", "workersAi"];

function metrics(product: MetricProduct, range: MetricRange, picked: readonly string[], now: Date): MetricsResponse {
  const { seconds, period } = RANGE_SPECS[range];
  const step = PERIOD_SECONDS[period] * 1000;
  const end = Math.floor(now.getTime() / step) * step + step;
  const count = Math.round((seconds * 1000) / step);
  const starts = Array.from({ length: count }, (_, index) => end - (count - index) * step);
  const times = starts.map((start) => new Date(start).toISOString().replace(".000Z", "Z"));
  const definition = PRODUCT_METRICS[product];
  const retained = (start: number) => !SHORT_RETENTION.includes(product) || now.getTime() - start <= 31 * DAY_MS;

  const sumSeries = new Map<string, Record<string, number[]>>();
  const gaugeSeries = new Map<string, Record<string, (number | null)[]>>();
  const resources: MetricResource[] = resourcesOf(product).map((resource) => {
    const sums: Record<string, number[]> = {};
    for (const metric of definition.sums) {
      const daily = resource.sums[metric] ?? 0;
      sums[metric] = starts.map((start, index) => {
        if (!retained(start)) return 0;
        // The period that is running now has only part of its traffic so far.
        const share = index === count - 1 ? Math.min(1, (now.getTime() - start) / step) : 1;
        const value = (daily * step) / DAY_MS * activity(new Date(start)) * share * jitter(`${resource.key}/${metric}/${start}`, 0.25);
        if (metric === "gbSeconds" || metric.endsWith("Ms")) return Math.round(value * 10) / 10;
        // Rounding that keeps the average, so that a rare count such as errors still shows up.
        return Math.floor(value + noise(`${resource.key}/${metric}/${start}/round`));
      });
    }
    const gauges: Record<string, (number | null)[]> = {};
    for (const metric of definition.gauges) {
      const latest = resource.gauges[metric] ?? 0;
      gauges[metric] = starts.map((start) => {
        if (metric === "backlog") return Math.round(latest * activity(new Date(start)) * jitter(`${resource.key}/backlog/${start}`, 0.6));
        // Storage grows slowly toward its size now.
        return Math.round(latest * (1 - ((now.getTime() - start) / DAY_MS) * 0.003));
      });
    }
    sumSeries.set(resource.key, sums);
    gaugeSeries.set(resource.key, gauges);
    return {
      key: resource.key,
      totals: Object.fromEntries(Object.entries(sums).map(([metric, values]) => [metric, values.reduce((total, value) => total + value, 0)])),
      latest: Object.fromEntries(Object.entries(gauges).map(([metric, values]) => [metric, values.at(-1) ?? null])),
    };
  });

  const rank = (resource: MetricResource) => resource.totals[RANK_METRIC[product]] ?? resource.latest[RANK_METRIC[product]] ?? 0;
  resources.sort((a, b) => rank(b) - rank(a) || a.key.localeCompare(b.key));
  const keys = resources.map((resource) => resource.key);
  const chosen = picked.filter((key) => keys.includes(key));
  const shown =
    chosen.length > 0 ? [...chosen].sort((a, b) => keys.indexOf(a) - keys.indexOf(b)) : keys.slice(0, MAX_PICKED_RESOURCES);
  const rest = chosen.length > 0 ? [] : keys.filter((key) => !shown.includes(key));

  const sums: MetricsResponse["sums"] = {};
  for (const metric of definition.sums) {
    const series: Record<string, number[]> = {};
    for (const key of shown) series[key] = sumSeries.get(key)?.[metric] ?? new Array<number>(count).fill(0);
    if (rest.length > 0) {
      series[OTHER_SERIES] = times.map((_, index) => rest.reduce((total, key) => total + (sumSeries.get(key)?.[metric]?.[index] ?? 0), 0));
    }
    sums[metric] = series;
  }
  const gauges: MetricsResponse["gauges"] = {};
  for (const metric of definition.gauges) {
    const series: Record<string, (number | null)[]> = {};
    for (const key of shown) series[key] = gaugeSeries.get(key)?.[metric] ?? new Array<number | null>(count).fill(null);
    if (rest.length > 0) {
      series[OTHER_SERIES] = times.map((_, index) => rest.reduce((total, key) => total + (gaugeSeries.get(key)?.[metric]?.[index] ?? 0), 0));
    }
    gauges[metric] = series;
  }
  const quantiles: MetricsResponse["quantiles"] = {};
  for (const metric of definition.quantiles) {
    const base = QUANTILES[product]?.[metric] ?? { p50: 1, p99: 10 };
    const at = (statistic: "p50" | "p99") =>
      starts.map((start) => (retained(start) ? Math.round(base[statistic] * jitter(`${metric}/${statistic}/${start}`, 0.3) * 100) / 100 : null));
    quantiles[metric] = { p50: at("p50"), p99: at("p99") };
  }

  return { product, range, period, times, resources, shown, sums, quantiles, gauges, names: namesOf(product) };
}

// Queries of the D1 databases: runs, and rows and time per run, on one day.
const QUERIES = [
  { database: 0, query: "SELECT * FROM posts WHERE published = ? ORDER BY created_at DESC LIMIT ?", runs: 9_400, read: 120, written: 0, ms: 0.9 },
  { database: 0, query: "SELECT * FROM users WHERE id = ?", runs: 21_000, read: 1, written: 0, ms: 0.2 },
  { database: 0, query: "UPDATE posts SET views = views + 1 WHERE id = ?", runs: 9_100, read: 1, written: 1, ms: 0.4 },
  { database: 0, query: "INSERT INTO comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)", runs: 640, read: 0, written: 3, ms: 0.5 },
  { database: 0, query: "SELECT count(*) FROM comments WHERE post_id = ?", runs: 9_000, read: 38, written: 0, ms: 0.3 },
  { database: 1, query: "SELECT date, sum(views) FROM page_views WHERE date >= ? GROUP BY date", runs: 310, read: 2_100, written: 0, ms: 6.4 },
  {
    database: 1,
    query: "INSERT INTO page_views (path, date, views) VALUES (?, ?, 1) ON CONFLICT (path, date) DO UPDATE SET views = views + 1",
    runs: 9_800,
    read: 1,
    written: 1,
    ms: 0.5,
  },
  { database: 1, query: "SELECT path, sum(views) AS views FROM page_views WHERE date >= ? GROUP BY path ORDER BY views DESC LIMIT ?", runs: 120, read: 2_400, written: 0, ms: 9.1 },
  { database: 2, query: "SELECT * FROM sessions WHERE token = ?", runs: 13_000, read: 1, written: 0, ms: 0.2 },
  { database: 2, query: "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", runs: 1_100, read: 0, written: 2, ms: 0.4 },
  { database: 2, query: "DELETE FROM sessions WHERE expires_at < ?", runs: 24, read: 3_400, written: 900, ms: 7.8 },
];

function topQueries(days: number, order: QueryOrder, databaseIds: readonly string[], now: Date): TopQueriesResponse {
  const to = utcDate(now);
  const queries: TopQuery[] = QUERIES.flatMap((item) => {
    const database = DATABASES[item.database];
    if (database === undefined || (databaseIds.length > 0 && !databaseIds.includes(database.id))) return [];
    const runs = Math.round(item.runs * days * jitter(`${item.query}/${days}`, 0.1));
    return [{ databaseId: database.id, query: item.query, runs, rowsRead: runs * item.read, rowsWritten: runs * item.written, durationMs: Math.round(runs * item.ms) }];
  });
  queries.sort((a, b) => b[order] - a[order]);
  return { from: addDays(to, -(days - 1)), to, order, queries: queries.slice(0, 20) };
}

/**
 * The invocations of each handler of the Workers per day, and their CPU time. They add up to
 * the requests of WORKERS, and cron-jobs runs its Cron Triggers every 5 minutes.
 */
const HANDLERS = [
  { worker: "web", handler: "fetch", invocations: 27_000, cpuMs: 4.2 },
  { worker: "api", handler: "fetch", invocations: 18_000, cpuMs: 6.8 },
  { worker: "image-resizer", handler: "fetch", invocations: 5_200, cpuMs: 38 },
  { worker: "auth", handler: "fetch", invocations: 4_600, cpuMs: 3.1 },
  { worker: "webhooks", handler: "fetch", invocations: 1_800, cpuMs: 4.1 },
  { worker: "webhooks", handler: "queue", invocations: 500, cpuMs: 10.5 },
  { worker: "cron-jobs", handler: "cron", invocations: 288, cpuMs: 520 },
  { worker: "cron-jobs", handler: "fetch", invocations: 1_112, cpuMs: 16.5 },
];

function workerHandlers(days: number, scriptNames: readonly string[], now: Date): WorkerHandlersResponse {
  const to = utcDate(now);
  const handlers: WorkerHandler[] = HANDLERS.flatMap((item) => {
    if (scriptNames.length > 0 && !scriptNames.includes(item.worker)) return [];
    const seed = `${item.worker}/${item.handler}/${days}`;
    const invocations = Math.round(item.invocations * days * jitter(seed, 0.1));
    const p50 = item.cpuMs * 0.8 * jitter(`${seed}/p50`, 0.1);
    return [
      {
        scriptName: item.worker,
        handler: item.handler,
        invocations,
        cpuTimeMs: Math.round(invocations * item.cpuMs),
        cpuTimeP50Ms: p50,
        cpuTimeP99Ms: p50 * 3 * jitter(`${seed}/p99`, 0.2),
      },
    ];
  });
  handlers.sort((a, b) => b.cpuTimeMs - a.cpuTimeMs);
  return { from: addDays(to, -(days - 1)), to, handlers };
}

function me(now: Date): MeResponse {
  return {
    me: {
      email: "you@example.com",
      method: "passkeys",
      signedInAt: new Date(now.getTime() - 2.25 * 3_600_000).toISOString(),
      // The demo has no Access session to end, so Log out opens the demo again.
      logoutUrl: import.meta.env.BASE_URL,
    },
  };
}

const isProduct = (value: string | null): value is MetricProduct => METRIC_PRODUCTS.some((product) => product === value);
const isRange = (value: string | null): value is MetricRange => METRIC_RANGES.some((range) => range === value);

/** The answer of the demo to a request for the API, such as /api/metrics?product=d1&range=1d. */
export function demoResponse(path: string): unknown {
  const url = new URL(path, "https://demo.invalid");
  const now = new Date();
  switch (url.pathname) {
    case "/api/me":
      return me(now);
    case "/api/settings":
      return settings(now);
    case "/api/usage":
      return usage(now);
    case "/api/metrics": {
      const product = url.searchParams.get("product");
      const range = url.searchParams.get("range");
      if (!isProduct(product) || !isRange(range)) throw new Error(`The demo has no metrics for ${url.search}.`);
      return metrics(product, range, url.searchParams.getAll("resource"), now);
    }
    case "/api/d1/top-queries": {
      const order = url.searchParams.get("order") === "rowsWritten" ? "rowsWritten" : "rowsRead";
      return topQueries(Number(url.searchParams.get("days") ?? "1"), order, url.searchParams.getAll("database"), now);
    }
    case "/api/workers/handlers":
      return workerHandlers(Number(url.searchParams.get("days") ?? "1"), url.searchParams.getAll("worker"), now);
    default:
      throw new Error(`The demo does not answer ${url.pathname}.`);
  }
}
