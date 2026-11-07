import { describe, expect, it } from "vitest";
import { emptyDay } from "../shared/usage.ts";
import { AnalyticsError, CloudflareAnalytics, r2Class, ROW_LIMIT, type FetchFn, type UsageAccount } from "../worker/analytics.ts";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const EMPTY: UsageAccount = {
  workers: [],
  d1: [],
  d1Storage: [],
  r2Operations: [],
  r2Storage: [],
  kv: [],
  workersStopped: [],
  pagesFunctions: [],
  durableObjects: [],
  durableObjectsPeriodic: [],
  durableObjectsStorage: [],
  queues: [],
  workersAi: [],
  hyperdrive: [],
  browserRun: [],
  workflows: [],
};

function graphql(account: unknown): Response {
  return Response.json({ data: { viewer: { accounts: [account] } }, errors: null });
}

function analyticsAnswering(answer: (url: string, init: RequestInit) => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return answer(url, init);
  };
  return { analytics: new CloudflareAnalytics(ACCOUNT, "token-1", fetchFn), calls };
}

describe("CloudflareAnalytics.dailyUsage", () => {
  it("asks the GraphQL API for the account and the dates, with the token", async () => {
    const { analytics, calls } = analyticsAnswering(() => graphql(EMPTY));
    await analytics.dailyUsage("2026-11-01", "2026-11-03");
    const call = calls[0];
    expect(call?.url).toBe("https://api.cloudflare.com/client/v4/graphql");
    expect(new Headers(call?.init.headers).get("Authorization")).toBe("Bearer token-1");
    const body = JSON.parse(String(call?.init.body)) as { query: string; variables: unknown };
    expect(body.variables).toEqual({
      accountTag: ACCOUNT,
      from: "2026-11-01",
      to: "2026-11-03",
      start: "2026-11-01T00:00:00Z",
      end: "2026-11-04T00:00:00Z",
    });
    expect(body.query).toContain("workersInvocationsAdaptive");
    expect(body.query).toContain("cpuTimeUs");
    expect(body.query).toContain("kvOperationsAdaptiveGroups");
    expect(body.query).toContain('status: "exceededResources"');
    expect(body.query).toContain("durableObjectsPeriodicGroups");
    expect(body.query).toContain("aiInferenceAdaptiveGroups");
  });

  it("adds up the rows of each day and resource, and keeps the dates without usage", async () => {
    const account: UsageAccount = {
      ...EMPTY,
      workers: [
        { sum: { requests: 10, cpuTimeUs: 2500 }, dimensions: { date: "2026-11-01", scriptName: "api" } },
        { sum: { requests: 5, cpuTimeUs: 500 }, dimensions: { date: "2026-11-01", scriptName: "api" } },
        { sum: { requests: 7, cpuTimeUs: 1000 }, dimensions: { date: "2026-11-02", scriptName: "blog" } },
      ],
      d1: [{ sum: { rowsRead: 100, rowsWritten: 3 }, dimensions: { date: "2026-11-01", databaseId: "db-1" } }],
      d1Storage: [
        { max: { databaseSizeBytes: 4096 }, dimensions: { date: "2026-11-01", databaseId: "db-1" } },
        { max: { databaseSizeBytes: 8192 }, dimensions: { date: "2026-11-02", databaseId: "db-2" } },
      ],
      r2Operations: [
        { sum: { requests: 4 }, dimensions: { date: "2026-11-02", bucketName: "files", actionType: "PutObject" } },
        { sum: { requests: 9 }, dimensions: { date: "2026-11-02", bucketName: "files", actionType: "GetObject" } },
        { sum: { requests: 2 }, dimensions: { date: "2026-11-02", bucketName: "files", actionType: "DeleteObject" } },
        { sum: { requests: 1 }, dimensions: { date: "2026-11-02", bucketName: "files", actionType: "SomeNewOperation" } },
      ],
      r2Storage: [{ max: { payloadSize: 1000, metadataSize: 24 }, dimensions: { date: "2026-11-02", bucketName: "files" } }],
      kv: [
        { sum: { requests: 30 }, dimensions: { date: "2026-11-01", actionType: "read" } },
        { sum: { requests: 2 }, dimensions: { date: "2026-11-01", actionType: "write" } },
        { sum: { requests: 1 }, dimensions: { date: "2026-11-02", actionType: "delete" } },
        { sum: { requests: 4 }, dimensions: { date: "2026-11-02", actionType: "list" } },
        { sum: { requests: 9 }, dimensions: { date: "2026-11-02", actionType: "someNewAction" } },
      ],
      workersStopped: [{ sum: { requests: 3 }, dimensions: { date: "2026-11-02" } }],
    };
    const { analytics } = analyticsAnswering(() => graphql(account));
    expect(await analytics.dailyUsage("2026-11-01", "2026-11-03")).toEqual([
      {
        ...emptyDay("2026-11-01"),
        workers: [{ scriptName: "api", requests: 15, cpuTimeMs: 3 }],
        d1: [{ databaseId: "db-1", rowsRead: 100, rowsWritten: 3, storageBytes: 4096 }],
        kv: { reads: 30, writes: 2, deletes: 0, lists: 0 },
      },
      {
        ...emptyDay("2026-11-02"),
        workers: [{ scriptName: "blog", requests: 7, cpuTimeMs: 1 }],
        workersStopped: 3,
        d1: [{ databaseId: "db-2", rowsRead: 0, rowsWritten: 0, storageBytes: 8192 }],
        r2: [{ bucketName: "files", classA: 5, classB: 9, storageBytes: 1024 }],
        kv: { reads: 0, writes: 0, deletes: 1, lists: 4 },
      },
      emptyDay("2026-11-03"),
    ]);
  });

  it("adds up the products with daily limits other than Workers, D1, R2, and KV", async () => {
    const account: UsageAccount = {
      ...EMPTY,
      pagesFunctions: [{ sum: { requests: 12 }, dimensions: { date: "2026-11-01" } }],
      durableObjects: [
        { sum: { requests: 40 }, dimensions: { date: "2026-11-01" } },
        { sum: { requests: 2 }, dimensions: { date: "2026-11-01" } },
      ],
      durableObjectsPeriodic: [{ sum: { duration: 12.5, rowsRead: 300, rowsWritten: 7 }, dimensions: { date: "2026-11-01" } }],
      // Each namespace counts with its most of the day.
      durableObjectsStorage: [
        { max: { storedBytes: 1000 }, dimensions: { date: "2026-11-01", namespaceId: "ns-1" } },
        { max: { storedBytes: 1500 }, dimensions: { date: "2026-11-01", namespaceId: "ns-1" } },
        { max: { storedBytes: 500 }, dimensions: { date: "2026-11-01", namespaceId: "ns-2" } },
      ],
      queues: [{ sum: { billableOperations: 30 }, dimensions: { date: "2026-11-01" } }],
      workersAi: [{ sum: { totalNeurons: 440.5 }, dimensions: { date: "2026-11-01" } }],
      hyperdrive: [{ count: 9, dimensions: { date: "2026-11-01" } }],
      browserRun: [{ sum: { totalSessionDurationMs: 90_000 }, dimensions: { date: "2026-11-01" } }],
      workflows: [{ sum: { allStepCount: 6 }, dimensions: { date: "2026-11-01" } }],
    };
    const { analytics } = analyticsAnswering(() => graphql(account));
    const [day] = await analytics.dailyUsage("2026-11-01", "2026-11-01");
    expect(day).toEqual({
      ...emptyDay("2026-11-01"),
      pagesFunctionsRequests: 12,
      durableObjects: { requests: 42, gbSeconds: 12.5, rowsRead: 300, rowsWritten: 7, storageBytes: 2000 },
      queuesOperations: 30,
      workersAiNeurons: 440.5,
      hyperdriveQueries: 9,
      browserRunMs: 90_000,
      workflowsSteps: 6,
    });
  });

  it("asks for each half of the range again when a dataset reaches the row limit", async () => {
    const row = (date: string) => ({ sum: { requests: 1, cpuTimeUs: 1000 }, dimensions: { date, scriptName: "api" } });
    const { analytics, calls } = analyticsAnswering((_url, init) => {
      const { from, to } = (JSON.parse(String(init.body)) as { variables: { from: string; to: string } }).variables;
      // The whole range is too many rows; each half fits in one answer.
      if (from !== to) return graphql({ ...EMPTY, workers: Array.from({ length: ROW_LIMIT }, () => row(from)) });
      return graphql({ ...EMPTY, workers: [row(from)] });
    });
    const days = await analytics.dailyUsage("2026-11-01", "2026-11-02");
    expect(days.map((day) => [day.date, day.workers[0]?.requests])).toEqual([
      ["2026-11-01", 1],
      ["2026-11-02", 1],
    ]);
    expect(calls).toHaveLength(3);
  });

  it("refuses a single day that reaches the row limit, rather than show part of it", async () => {
    const row = { sum: { requests: 1, cpuTimeUs: 1 }, dimensions: { date: "2026-11-01", scriptName: "api" } };
    const { analytics } = analyticsAnswering(() => graphql({ ...EMPTY, workers: Array.from({ length: ROW_LIMIT }, () => row) }));
    await expect(analytics.dailyUsage("2026-11-01", "2026-11-01")).rejects.toThrow(/10000 rows of workers for 2026-11-01 alone/);
  });

  it("passes on the errors of the GraphQL API", async () => {
    const { analytics } = analyticsAnswering(() => Response.json({ data: null, errors: [{ message: "not authorized for that account" }] }));
    await expect(analytics.dailyUsage("2026-11-01", "2026-11-01")).rejects.toThrow(
      new AnalyticsError("The Cloudflare GraphQL API returned errors: not authorized for that account"),
    );
  });

  it("passes on an HTTP error with its status", async () => {
    const { analytics } = analyticsAnswering(() => new Response("Forbidden", { status: 403 }));
    await expect(analytics.dailyUsage("2026-11-01", "2026-11-01")).rejects.toThrow(/answered 403: Forbidden/);
  });

  it("reports an answer without the account", async () => {
    const { analytics } = analyticsAnswering(() => Response.json({ data: { viewer: { accounts: [] } }, errors: null }));
    await expect(analytics.dailyUsage("2026-11-01", "2026-11-01")).rejects.toThrow(/no data for the account/);
  });

  it("covers at most 31 days in one query", async () => {
    const { analytics, calls } = analyticsAnswering(() => graphql(EMPTY));
    await expect(analytics.dailyUsage("2026-10-01", "2026-11-01")).rejects.toThrow(RangeError);
    expect(calls).toHaveLength(0);
  });
});

describe("CloudflareAnalytics.topQueries", () => {
  it("orders the D1 queries by the asked metric", async () => {
    const { analytics, calls } = analyticsAnswering(() =>
      graphql({
        queries: [
          { count: 3, sum: { rowsRead: 30, rowsWritten: 6, queryDurationMs: 1.5 }, dimensions: { query: "INSERT INTO t VALUES (?)", databaseId: "db-1" } },
          { count: 1, sum: { rowsRead: 0, rowsWritten: 0, queryDurationMs: 0 }, dimensions: { query: "", databaseId: "db-1" } },
        ],
      }),
    );
    expect(await analytics.topQueries("2026-10-30", "2026-11-05", "rowsWritten", 20, [])).toEqual([
      { databaseId: "db-1", query: "INSERT INTO t VALUES (?)", runs: 3, rowsRead: 30, rowsWritten: 6, durationMs: 1.5 },
    ]);
    const body = JSON.parse(String(calls[0]?.init.body)) as { query: string; variables: unknown };
    expect(body.query).toContain("orderBy: [sum_rowsWritten_DESC]");
    expect(body.query).toContain("limit: 20");
    expect(body.query).not.toContain("databaseId_in");
    expect(body.variables).toEqual({ accountTag: ACCOUNT, start: "2026-10-30T00:00:00Z", end: "2026-11-06T00:00:00Z" });
  });

  it("narrows the queries to the given databases", async () => {
    const { analytics, calls } = analyticsAnswering(() => graphql({ queries: [] }));
    await analytics.topQueries("2026-11-05", "2026-11-05", "rowsRead", 20, ["db-1", "db-2"]);
    const body = JSON.parse(String(calls[0]?.init.body)) as { query: string; variables: Record<string, unknown> };
    expect(body.query).toContain("$databaseIds: [string!]");
    expect(body.query).toContain("databaseId_in: $databaseIds");
    expect(body.variables["databaseIds"]).toEqual(["db-1", "db-2"]);
  });
});

describe("CloudflareAnalytics.workerHandlers", () => {
  it("orders the handlers of the Workers by their CPU time, in milliseconds", async () => {
    const { analytics, calls } = analyticsAnswering(() =>
      graphql({
        handlers: [
          {
            sum: { requests: 288, cpuTimeUs: 9_000_000 },
            quantiles: { cpuTimeP50: 30_000, cpuTimeP99: 70_500 },
            dimensions: { scriptName: "jobs", eventType: "cron" },
          },
        ],
      }),
    );
    expect(await analytics.workerHandlers("2026-10-30", "2026-11-05", 50, [])).toEqual([
      { scriptName: "jobs", handler: "cron", invocations: 288, cpuTimeMs: 9_000, cpuTimeP50Ms: 30, cpuTimeP99Ms: 70.5 },
    ]);
    const body = JSON.parse(String(calls[0]?.init.body)) as { query: string; variables: unknown };
    expect(body.query).toContain("orderBy: [sum_cpuTimeUs_DESC]");
    expect(body.query).toContain("dimensions { scriptName eventType }");
    expect(body.query).toContain("limit: 50");
    expect(body.query).not.toContain("scriptName_in");
    expect(body.variables).toEqual({ accountTag: ACCOUNT, start: "2026-10-30T00:00:00Z", end: "2026-11-06T00:00:00Z" });
  });

  it("narrows the handlers to the given Workers", async () => {
    const { analytics, calls } = analyticsAnswering(() => graphql({ handlers: [] }));
    await analytics.workerHandlers("2026-11-05", "2026-11-05", 50, ["api", "web"]);
    const body = JSON.parse(String(calls[0]?.init.body)) as { query: string; variables: Record<string, unknown> };
    expect(body.query).toContain("scriptName_in: $scriptNames");
    expect(body.variables["scriptNames"]).toEqual(["api", "web"]);
  });
});

describe("CloudflareAnalytics.cronTriggers", () => {
  const scripts = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts`;

  it("counts the Cron Triggers of the Workers with a scheduled handler", async () => {
    const { analytics, calls } = analyticsAnswering((url) => {
      if (url === scripts) {
        return Response.json({
          success: true,
          result: [
            { id: "web", handlers: ["fetch"] },
            { id: "jobs", handlers: ["fetch", "scheduled"] },
            { id: "old" },
          ],
        });
      }
      const schedules = url.includes("/jobs/") ? [{ cron: "*/5 * * * *" }, { cron: "0 0 * * *" }] : [{ cron: "0 3 * * *" }];
      return Response.json({ success: true, result: { schedules } });
    });
    expect(await analytics.cronTriggers()).toBe(3);
    // A Worker without the handlers in the list is asked for its Cron Triggers too.
    expect(calls.map((call) => call.url).sort()).toEqual([scripts, `${scripts}/jobs/schedules`, `${scripts}/old/schedules`]);
  });

  it("reports a token that may not read the Workers, which lists none", async () => {
    const { analytics } = analyticsAnswering(() => Response.json({ success: true, result: [] }));
    await expect(analytics.cronTriggers()).rejects.toThrow(/Workers Scripts Read/);
  });
});

describe("CloudflareAnalytics.databaseNames", () => {
  it("reads every page of the D1 databases", async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({ uuid: `id-${start + index}`, name: `db-${start + index}` }));
    const { analytics, calls } = analyticsAnswering((url) =>
      Response.json({ success: true, result: url.includes("page=1&") ? page(0, 100) : page(100, 1) }),
    );
    const names = await analytics.databaseNames();
    expect(Object.keys(names)).toHaveLength(101);
    expect(names["id-100"]).toBe("db-100");
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database?page=1&per_page=100`,
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database?page=2&per_page=100`,
    ]);
  });
});

describe("r2Class", () => {
  it("prices R2 operations by their published class", () => {
    expect(r2Class("PutObject")).toBe("A");
    expect(r2Class("ListObjects")).toBe("A");
    expect(r2Class("GetObject")).toBe("B");
    expect(r2Class("HeadObject")).toBe("B");
    expect(r2Class("DeleteObject")).toBe("free");
  });

  it("counts an operation that the price list does not name as Class A", () => {
    expect(r2Class("SomeNewOperation")).toBe("A");
  });
});
