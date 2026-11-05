import { describe, expect, it } from "vitest";
import { AnalyticsError, CloudflareAnalytics, r2Class, ROW_LIMIT, type FetchFn, type UsageAccount } from "../worker/analytics.ts";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const EMPTY: UsageAccount = { workers: [], d1: [], d1Storage: [], r2Operations: [], r2Storage: [] };

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
  });

  it("adds up the rows of each day and resource, and keeps the dates without usage", async () => {
    const account: UsageAccount = {
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
    };
    const { analytics } = analyticsAnswering(() => graphql(account));
    expect(await analytics.dailyUsage("2026-11-01", "2026-11-03")).toEqual([
      {
        date: "2026-11-01",
        workers: [{ scriptName: "api", requests: 15, cpuTimeMs: 3 }],
        d1: [{ databaseId: "db-1", rowsRead: 100, rowsWritten: 3, storageBytes: 4096 }],
        r2: [],
      },
      {
        date: "2026-11-02",
        workers: [{ scriptName: "blog", requests: 7, cpuTimeMs: 1 }],
        d1: [{ databaseId: "db-2", rowsRead: 0, rowsWritten: 0, storageBytes: 8192 }],
        r2: [{ bucketName: "files", classA: 5, classB: 9, storageBytes: 1024 }],
      },
      { date: "2026-11-03", workers: [], d1: [], r2: [] },
    ]);
  });

  it("refuses a dataset that reached the row limit, rather than show part of it", async () => {
    const row = { sum: { requests: 1, cpuTimeUs: 1 }, dimensions: { date: "2026-11-01", scriptName: "api" } };
    const { analytics } = analyticsAnswering(() => graphql({ ...EMPTY, workers: Array.from({ length: ROW_LIMIT }, () => row) }));
    await expect(analytics.dailyUsage("2026-11-01", "2026-11-01")).rejects.toThrow(/10000 rows of workers/);
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
    expect(await analytics.topQueries("2026-10-30", "2026-11-05", "rowsWritten", 20)).toEqual([
      { databaseId: "db-1", query: "INSERT INTO t VALUES (?)", runs: 3, rowsRead: 30, rowsWritten: 6, durationMs: 1.5 },
    ]);
    const body = JSON.parse(String(calls[0]?.init.body)) as { query: string; variables: unknown };
    expect(body.query).toContain("orderBy: [sum_rowsWritten_DESC]");
    expect(body.query).toContain("limit: 20");
    expect(body.variables).toEqual({ accountTag: ACCOUNT, start: "2026-10-30T00:00:00Z", end: "2026-11-06T00:00:00Z" });
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
