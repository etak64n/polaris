import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TopQueriesResponse, UsageResponse } from "../shared/api.ts";
import { AnalyticsError } from "../worker/analytics.ts";
import { createApp } from "../worker/app.ts";
import { noCache } from "../worker/cache.ts";
import type { Env } from "../worker/env.ts";
import { UsageHistory } from "../worker/history.ts";
import { AUD, createAccessKeys, TEAM_DOMAIN, type AccessKeys } from "./support/access.ts";
import { FakeUsageSource, MemoryBucket, usageOf } from "./support/fakes.ts";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-11-05T12:00:00Z");

let keys: AccessKeys;
let source: FakeUsageSource;
let bucket: MemoryBucket;

beforeAll(async () => {
  keys = await createAccessKeys();
});

beforeEach(() => {
  source = new FakeUsageSource();
  bucket = new MemoryBucket();
});

function env(overrides: Partial<Env> = {}): Env {
  return {
    HISTORY: bucket,
    AUTH_MODE: "cloudflare-access",
    ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    ACCESS_AUD: AUD,
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
    BILLING_PLAN: "free",
    BILLING_CYCLE_START_DAY: "1",
    ANALYTICS_API_TOKEN: "token",
    ...overrides,
  };
}

function app() {
  return createApp({ keySetFor: () => keys.keySet, usageSourceFor: () => source, cacheFor: () => noCache, now: () => NOW });
}

async function get(path: string, options: { token?: string | null; env?: Env; origin?: string } = {}): Promise<Response> {
  const token = options.token === undefined ? await keys.sign() : options.token;
  const headers: Record<string, string> = token === null ? {} : { "Cf-Access-Jwt-Assertion": token };
  return app().request(`${options.origin ?? "https://usage.example.com"}${path}`, { headers }, options.env ?? env());
}

describe("Cloudflare Access", () => {
  it("answers nothing without an Access token", async () => {
    const response = await get("/api/usage?days=31", { token: null });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "access_denied" } });
    expect(source.usageCalls).toHaveLength(0);
  });

  it("answers nothing to a token for another application", async () => {
    const response = await get("/api/usage?days=31", { token: await keys.sign({ audience: "another-app" }) });
    expect(response.status).toBe(403);
  });

  it("answers localhost without a token in the local development mode, and nothing else", async () => {
    const local = env({ AUTH_MODE: "local-development" });
    expect((await get("/api/usage?days=31", { token: null, env: local, origin: "http://localhost:5173" })).status).toBe(200);
    expect((await get("/api/usage?days=31", { token: null, env: local })).status).toBe(403);
  });
});

describe("GET /api/usage", () => {
  it("returns every date of the range, today last, from Cloudflare analytics", async () => {
    source.usage = (date) => usageOf(date, 1);
    source.names = { "db-1": "blog" };
    const response = await get("/api/usage?days=31");
    expect(response.status).toBe(200);
    const body = (await response.json()) as UsageResponse;
    expect(body.plan).toBe("free");
    expect(body.cycleStartDay).toBe(1);
    expect(body.today).toBe("2026-11-05");
    expect(body.liveFrom).toBe("2026-10-06");
    expect(body.days).toHaveLength(31);
    expect(body.days[0]?.date).toBe("2026-10-06");
    expect(body.days.at(-1)).toEqual(usageOf("2026-11-05", 1));
    expect(body.databaseNames).toEqual({ "db-1": "blog" });
    expect(source.usageCalls).toEqual([{ from: "2026-10-06", to: "2026-11-05" }]);
  });

  it("takes the days that analytics no longer hold from the history bucket", async () => {
    const history = new UsageHistory(bucket);
    await history.record([usageOf("2026-08-01", 9), usageOf("2026-09-10", 7), usageOf("2026-10-05", 3)]);
    const body = (await (await get("/api/usage?days=90")).json()) as UsageResponse;
    expect(body.days).toHaveLength(90);
    expect(body.days[0]?.date).toBe("2026-08-08");
    const byDate = new Map(body.days.map((day) => [day.date, day]));
    expect(byDate.get("2026-09-10")).toEqual(usageOf("2026-09-10", 7));
    expect(byDate.get("2026-10-05")).toEqual(usageOf("2026-10-05", 3));
    expect(byDate.get("2026-09-11")).toEqual({ date: "2026-09-11", workers: [], d1: [], r2: [] });
    expect(byDate.has("2026-08-01")).toBe(false);
  });

  it("requires a number of days within the limits", async () => {
    for (const query of ["", "?days=30", "?days=401", "?days=abc", "?days=31.5"]) {
      const response = await get(`/api/usage${query}`);
      expect(response.status).toBe(400);
    }
  });

  it("reports that Cloudflare analytics failed, with the reason", async () => {
    source.failure = new AnalyticsError("The Cloudflare API answered 403: Forbidden");
    const response = await get("/api/usage?days=31");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: "analytics_unavailable", message: "The Cloudflare API answered 403: Forbidden" },
    });
  });

  it("refuses to run without the API token", async () => {
    const response = await get("/api/usage?days=31", { env: env({ ANALYTICS_API_TOKEN: "" }) });
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "configuration" } });
  });
});

describe("GET /api/d1/top-queries", () => {
  it("returns the queries of the last days in the asked order", async () => {
    source.queries = [{ databaseId: "db-1", query: "SELECT 1", runs: 2, rowsRead: 2, rowsWritten: 0, durationMs: 0.1 }];
    const response = await get("/api/d1/top-queries?days=7&order=rowsWritten");
    expect(response.status).toBe(200);
    const body = (await response.json()) as TopQueriesResponse;
    expect(body).toEqual({ from: "2026-10-30", to: "2026-11-05", order: "rowsWritten", queries: source.queries });
    expect(source.queryCalls).toEqual([{ from: "2026-10-30", to: "2026-11-05", order: "rowsWritten", limit: 20 }]);
  });

  it("accepts only the offered periods and orders", async () => {
    expect((await get("/api/d1/top-queries?days=3&order=rowsRead")).status).toBe(400);
    expect((await get("/api/d1/top-queries?days=1")).status).toBe(400);
  });
});

describe("other paths", () => {
  it("answers 404 to an API that does not exist", async () => {
    expect((await get("/api/nothing")).status).toBe(404);
  });
});
