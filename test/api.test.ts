import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MeResponse, TopQueriesResponse, UsageResponse } from "../shared/api.ts";
import type { MetricsResponse } from "../shared/metrics.ts";
import { AnalyticsError } from "../worker/analytics.ts";
import { createApp } from "../worker/app.ts";
import { noCache } from "../worker/cache.ts";
import type { Env } from "../worker/env.ts";
import type { IdentityFetcher } from "../worker/access.ts";
import { AUD, createAccessKeys, TEAM_DOMAIN, VIEWER_EMAIL, type AccessKeys } from "./support/access.ts";
import { FakeUsageSource, usageOf } from "./support/fakes.ts";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-11-05T12:00:00Z");

let keys: AccessKeys;
let source: FakeUsageSource;
// The identity of the session that Access answers, and the requests for it.
let identity: IdentityFetcher;
let identityCalls: { teamDomain: string; token: string }[];

/** A sign-in with a passkey at 2026-11-07T05:42:45Z, as Access reports it. */
const SIGNED_IN_IDENTITY = { email: VIEWER_EMAIL, idp: { id: "idp-passkeys", type: "passkeys" }, iat: 1_794_030_165 };

beforeAll(async () => {
  keys = await createAccessKeys();
});

beforeEach(() => {
  source = new FakeUsageSource();
  identity = async () => SIGNED_IN_IDENTITY;
  identityCalls = [];
});

function env(overrides: Partial<Env> = {}): Env {
  return {
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
  return createApp({
    keySetFor: () => keys.keySet,
    fetchIdentity: (teamDomain, token) => {
      identityCalls.push({ teamDomain, token });
      return identity(teamDomain, token);
    },
    usageSourceFor: () => source,
    cacheFor: () => noCache,
    now: () => NOW,
  });
}

async function get(path: string, options: { token?: string | null; env?: Env; origin?: string } = {}): Promise<Response> {
  const token = options.token === undefined ? await keys.sign() : options.token;
  const headers: Record<string, string> = token === null ? {} : { "Cf-Access-Jwt-Assertion": token };
  return app().request(`${options.origin ?? "https://usage.example.com"}${path}`, { headers }, options.env ?? env());
}

describe("Cloudflare Access", () => {
  it("answers nothing without an Access token", async () => {
    const response = await get("/api/usage", { token: null });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "access_denied" } });
    expect(source.usageCalls).toHaveLength(0);
  });

  it("answers nothing to a token for another application", async () => {
    const response = await get("/api/usage", { token: await keys.sign({ audience: "another-app" }) });
    expect(response.status).toBe(403);
  });

  it("answers localhost without a token in the local development mode, and nothing else", async () => {
    const local = env({ AUTH_MODE: "local-development" });
    expect((await get("/api/usage", { token: null, env: local, origin: "http://localhost:5173" })).status).toBe(200);
    expect((await get("/api/usage", { token: null, env: local })).status).toBe(403);
  });
});

describe("GET /api/me", () => {
  it("tells who signed in, with the login method and the time of the sign-in from Access", async () => {
    const token = await keys.sign();
    const response = await get("/api/me", { token });
    expect(response.status).toBe(200);
    expect((await response.json()) as MeResponse).toEqual({
      me: { email: VIEWER_EMAIL, method: "passkeys", signedInAt: "2026-11-07T05:42:45.000Z", logoutUrl: "/cdn-cgi/access/logout" },
    });
    expect(identityCalls).toEqual([{ teamDomain: TEAM_DOMAIN, token }]);
  });

  it("answers 502 when Access does not tell the login method", async () => {
    identity = async () => ({ email: VIEWER_EMAIL, iat: 1_794_030_165 });
    const response = await get("/api/me");
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "access_unavailable" } });
  });

  it("answers 502 with the reason when Access cannot be reached", async () => {
    identity = async () => {
      throw new Error("Cloudflare Access answered 503 for the identity of the session.");
    };
    const response = await get("/api/me");
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain("Cloudflare Access answered 503");
  });

  it("names no person for a service token", async () => {
    const response = await get("/api/me", { token: await keys.sign({ email: null }) });
    expect(response.status).toBe(403);
    expect(identityCalls).toEqual([]);
  });

  it("names nobody under cf dev, without asking Access", async () => {
    const response = await get("/api/me", { token: null, env: env({ AUTH_MODE: "local-development" }), origin: "http://localhost:5173" });
    expect(response.status).toBe(200);
    expect((await response.json()) as MeResponse).toEqual({ me: null });
    expect(identityCalls).toEqual([]);
  });
});

describe("GET /api/usage", () => {
  it("returns the last 31 days, today last, from Cloudflare analytics", async () => {
    source.usage = (date) => usageOf(date, 1);
    source.names = { "db-1": "blog" };
    const response = await get("/api/usage");
    expect(response.status).toBe(200);
    const body = (await response.json()) as UsageResponse;
    expect(body.plan).toBe("free");
    expect(body.cycleStartDay).toBe(1);
    expect(body.today).toBe("2026-11-05");
    expect(body.days).toHaveLength(31);
    expect(body.days[0]?.date).toBe("2026-10-06");
    expect(body.days.at(-1)).toEqual(usageOf("2026-11-05", 1));
    expect(body.databaseNames).toEqual({ "db-1": "blog" });
    expect(source.usageCalls).toEqual([{ from: "2026-10-06", to: "2026-11-05" }]);
  });

  it("reports that Cloudflare analytics failed, with the reason", async () => {
    source.failure = new AnalyticsError("The Cloudflare API answered 403: Forbidden");
    const response = await get("/api/usage");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: "analytics_unavailable", message: "The Cloudflare API answered 403: Forbidden" },
    });
  });

  it("refuses to run without the API token", async () => {
    const response = await get("/api/usage", { env: env({ ANALYTICS_API_TOKEN: "" }) });
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
    expect(source.queryCalls).toEqual([{ from: "2026-10-30", to: "2026-11-05", order: "rowsWritten", limit: 20, databaseIds: [] }]);
  });

  it("narrows the queries to the given databases", async () => {
    const first = "11111111-2222-3333-4444-555555555555";
    const second = "00000000-aaaa-bbbb-cccc-dddddddddddd";
    const response = await get(`/api/d1/top-queries?days=1&order=rowsRead&database=${first}&database=${second}&database=${first}`);
    expect(response.status).toBe(200);
    expect(source.queryCalls[0]?.databaseIds).toEqual([second, first]);
  });

  it("accepts only the offered periods and orders", async () => {
    expect((await get("/api/d1/top-queries?days=3&order=rowsRead")).status).toBe(400);
    expect((await get("/api/d1/top-queries?days=1")).status).toBe(400);
  });

  it("refuses a database that is not a D1 database ID, and more databases than the most", async () => {
    expect((await get("/api/d1/top-queries?days=1&order=rowsRead&database=blog")).status).toBe(400);
    const ids = Array.from({ length: 6 }, (_, index) => `database=0000000${index}-0000-0000-0000-000000000000`).join("&");
    expect((await get(`/api/d1/top-queries?days=1&order=rowsRead&${ids}`)).status).toBe(400);
    expect(source.queryCalls).toHaveLength(0);
  });
});

describe("GET /api/metrics", () => {
  it("returns the metrics of the product with the names of the D1 databases", async () => {
    const database = "11111111-2222-3333-4444-555555555555";
    source.names = { [database]: "notes" };
    const response = await get(`/api/metrics?product=d1&range=1d&resource=${database}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as MetricsResponse;
    expect(body).toMatchObject({ product: "d1", range: "1d", shown: [database], names: { [database]: "notes" } });
    expect(source.metricCalls).toEqual([{ product: "d1", range: "1d", picked: [database], now: NOW }]);
  });

  it("names no databases for the other products", async () => {
    const body = (await (await get("/api/metrics?product=workers&range=1h")).json()) as MetricsResponse;
    expect(body.names).toEqual({});
  });

  it("names the resources of the products whose analytics give IDs, such as the namespaces of KV", async () => {
    const namespace = "0123456789abcdef0123456789abcdef";
    source.resourceNamesOf = { kv: { [namespace]: "sessions" } };
    const response = await get(`/api/metrics?product=kv&range=1d&resource=${namespace}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as MetricsResponse;
    expect(body).toMatchObject({ product: "kv", shown: [namespace], names: { [namespace]: "sessions" } });
  });

  it("takes the account as the only resource of Browser Run", async () => {
    expect((await get("/api/metrics?product=browserRun&range=1d&resource=")).status).toBe(200);
    expect((await get("/api/metrics?product=browserRun&range=1d&resource=session")).status).toBe(400);
  });

  it("refuses an unknown product, range, or resource, and more resources than the most", async () => {
    expect((await get("/api/metrics?product=vectorize&range=1d")).status).toBe(400);
    expect((await get("/api/metrics?product=workers&range=2d")).status).toBe(400);
    expect((await get("/api/metrics?product=d1&range=1d&resource=blog")).status).toBe(400);
    const six = Array.from({ length: 6 }, (_, index) => `resource=worker-${index}`).join("&");
    expect((await get(`/api/metrics?product=workers&range=1d&${six}`)).status).toBe(400);
    expect(source.metricCalls).toHaveLength(0);
  });
});

describe("other paths", () => {
  it("answers 404 to an API that does not exist", async () => {
    expect((await get("/api/nothing")).status).toBe(404);
  });
});
