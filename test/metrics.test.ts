import { describe, expect, it } from "vitest";
import { OTHER_SERIES } from "../shared/metrics.ts";
import { ROW_LIMIT } from "../worker/analytics.ts";
import { metricsWindow, productMetrics, type GraphqlFn } from "../worker/metrics.ts";

const NOW = new Date("2026-11-06T10:30:30Z");

interface Call {
  query: string;
  variables: Record<string, string | string[]>;
}

/** Answers each query with the rows that `answer` gives, and records the queries. */
function graphqlAnswering(answer: (call: Call) => Record<string, unknown[]>): { graphql: GraphqlFn; calls: Call[] } {
  const calls: Call[] = [];
  const graphql = async <T>(query: string, variables: Record<string, string | string[]>): Promise<T> => {
    const call = { query, variables };
    calls.push(call);
    return answer(call) as T;
  };
  return { graphql, calls };
}

const workerRow = (key: string, t: string, requests: number) => ({
  sum: { requests, errors: 1, subrequests: 2, cpuTimeUs: requests * 1000 },
  dimensions: { key, t },
});

describe("metricsWindow", () => {
  it("ends with the running period and holds the whole range", () => {
    const window = metricsWindow("1h", NOW);
    expect(window.period).toBe("1m");
    expect(window.times).toHaveLength(60);
    expect(window.times[0]).toBe("2026-11-06T09:31:00Z");
    expect(window.times.at(-1)).toBe("2026-11-06T10:30:00Z");
  });

  it("uses whole UTC days for the long ranges", () => {
    const window = metricsWindow("30d", NOW);
    expect(window.period).toBe("1d");
    expect(window.times).toHaveLength(30);
    expect(window.times.at(-1)).toBe("2026-11-06T00:00:00Z");
  });
});

describe("productMetrics", () => {
  it("gives the five largest Workers their own series and adds up the rest as other", async () => {
    const names = ["a", "b", "c", "d", "e", "f", "g"];
    const { graphql, calls } = graphqlAnswering(() => ({
      sums: names.flatMap((key, rank) => [workerRow(key, "2026-11-06T10:29:00Z", 70 - rank * 10), workerRow(key, "2026-11-06T10:30:00Z", 1)]),
      stats: [{ quantiles: { cpuTimeP50: 1500, cpuTimeP99: 9000, wallTimeP50: 20000, wallTimeP99: 80000 }, dimensions: { t: "2026-11-06T10:30:00Z" } }],
    }));

    const metrics = await productMetrics(graphql, "workers", "1h", [], NOW);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("t: datetimeMinute");
    expect(calls[0]?.query).not.toContain("$gaugeStart");
    expect(calls[0]?.query).not.toContain("scriptName_in");
    expect(calls[0]?.variables).toEqual({ start: "2026-11-06T09:31:00Z", end: "2026-11-06T10:31:00Z" });
    expect(metrics.resources.map((resource) => resource.key)).toEqual(names);
    expect(metrics.shown).toEqual(["a", "b", "c", "d", "e"]);
    expect(metrics.resources[0]?.totals).toEqual({ requests: 71, errors: 2, subrequests: 4, cpuTimeMs: 71 });
    const requests = metrics.sums["requests"] ?? {};
    expect(requests["a"]?.slice(-2)).toEqual([70, 1]);
    // f and g, 20 and 10 requests at 10:29, one each at 10:30.
    expect(requests[OTHER_SERIES]?.slice(-2)).toEqual([30, 2]);
    expect(metrics.quantiles["cpuTimeMs"]?.p99.at(-1)).toBe(9);
    expect(metrics.quantiles["wallTimeMs"]?.p50.at(-1)).toBe(20);
    expect(metrics.quantiles["cpuTimeMs"]?.p50.at(-2)).toBeNull();
  });

  it("keeps a Worker named other apart from the series of the rest", async () => {
    const names = ["other", "b", "c", "d", "e", "f"];
    const { graphql } = graphqlAnswering(() => ({
      sums: names.map((key, rank) => workerRow(key, "2026-11-06T10:30:00Z", 60 - rank * 10)),
      stats: [],
    }));

    const metrics = await productMetrics(graphql, "workers", "1h", [], NOW);

    const requests = metrics.sums["requests"] ?? {};
    expect(metrics.shown).toContain("other");
    expect(requests["other"]?.at(-1)).toBe(60);
    expect(requests[OTHER_SERIES]?.at(-1)).toBe(10);
  });

  it("shows only the picked resources and computes their quantiles together", async () => {
    const { graphql, calls } = graphqlAnswering(() => ({
      sums: [workerRow("api", "2026-11-06T10:30:00Z", 5), workerRow("web", "2026-11-06T10:30:00Z", 9)],
      stats: [],
    }));

    const metrics = await productMetrics(graphql, "workers", "1h", ["api"], NOW);

    expect(calls[0]?.query).toContain("$picked: [string!]");
    expect(calls[0]?.query).toContain("scriptName_in: $picked");
    expect(calls[0]?.variables["picked"]).toEqual(["api"]);
    expect(metrics.shown).toEqual(["api"]);
    expect(Object.keys(metrics.sums["requests"] ?? {})).toEqual(["api"]);
    expect(metrics.resources.map((resource) => resource.key)).toEqual(["web", "api"]);
  });

  it("classifies R2 operations and carries the hourly storage over shorter periods", async () => {
    const { graphql, calls } = graphqlAnswering(() => ({
      sums: [
        { sum: { requests: 3 }, dimensions: { key: "media", action: "PutObject", t: "2026-11-06T10:30:00Z" } },
        { sum: { requests: 8 }, dimensions: { key: "media", action: "GetObject", t: "2026-11-06T10:30:00Z" } },
        { sum: { requests: 4 }, dimensions: { key: "media", action: "DeleteObject", t: "2026-11-06T10:30:00Z" } },
      ],
      gauges: [
        // The sample of the hour before the range, then the sample of 10:00.
        { max: { payloadSize: 900, metadataSize: 100, objectCount: 4 }, dimensions: { key: "media", t: "2026-11-06T09:00:00Z" } },
        { max: { payloadSize: 1900, metadataSize: 100, objectCount: 5 }, dimensions: { key: "media", t: "2026-11-06T10:00:00Z" } },
      ],
    }));

    const metrics = await productMetrics(graphql, "r2", "1h", ["media"], NOW);

    // R2 has no quantiles, so the query declares no picked variable that it would not use.
    expect(calls[0]?.query).not.toContain("$picked");
    expect(calls[0]?.variables["gaugeStart"]).toBe("2026-11-06T08:31:00Z");
    expect(calls[0]?.query).toContain("t: datetimeHour");
    expect(metrics.sums["classA"]?.["media"]?.at(-1)).toBe(3);
    expect(metrics.sums["classB"]?.["media"]?.at(-1)).toBe(8);
    const storage = metrics.gauges["storageBytes"]?.["media"] ?? [];
    expect(storage[0]).toBe(1000);
    expect(storage.at(-1)).toBe(2000);
    expect(metrics.resources[0]?.latest).toEqual({ storageBytes: 2000, objects: 5 });
  });

  it("splits the KV operations by action, with the latency of the picked namespaces and their storage", async () => {
    const namespace = "0123456789abcdef0123456789abcdef";
    const { graphql, calls } = graphqlAnswering(() => ({
      sums: [
        { sum: { requests: 40 }, dimensions: { key: namespace, action: "read", t: "2026-11-06T10:30:00Z" } },
        { sum: { requests: 3 }, dimensions: { key: namespace, action: "write", t: "2026-11-06T10:30:00Z" } },
        { sum: { requests: 1 }, dimensions: { key: namespace, action: "list", t: "2026-11-06T10:30:00Z" } },
      ],
      stats: [{ quantiles: { latencyMsP50: 4, latencyMsP99: 30 }, dimensions: { t: "2026-11-06T10:30:00Z" } }],
      gauges: [{ max: { byteCount: 2048, keyCount: 12 }, dimensions: { key: namespace, t: "2026-11-06T10:00:00Z" } }],
    }));

    const metrics = await productMetrics(graphql, "kv", "1h", [namespace], NOW);

    expect(calls[0]?.query).toContain("namespaceId_in: $picked");
    expect(metrics.resources[0]?.totals).toEqual({ reads: 40, writes: 3, deletes: 0, lists: 1 });
    expect(metrics.quantiles["latencyMs"]?.p99.at(-1)).toBe(30);
    expect(metrics.resources[0]?.latest).toEqual({ storageBytes: 2048, keys: 12 });
  });

  it("adds the requests of the Durable Objects invocations to the duration and rows of their samples", async () => {
    const namespace = "fedcba9876543210fedcba9876543210";
    const { graphql, calls } = graphqlAnswering(() => ({
      sums: [{ sum: { requests: 20, errors: 1 }, dimensions: { key: namespace, t: "2026-11-06T10:30:00Z" } }],
      moreSums: [{ sum: { duration: 2.5, rowsRead: 300, rowsWritten: 9 }, dimensions: { key: namespace, t: "2026-11-06T10:30:00Z" } }],
      gauges: [],
    }));

    const metrics = await productMetrics(graphql, "durableObjects", "1h", [], NOW);

    expect(calls[0]?.query).toContain("durableObjectsPeriodicGroups");
    expect(metrics.resources[0]?.totals).toEqual({ requests: 20, errors: 1, gbSeconds: 2.5, rowsRead: 300, rowsWritten: 9 });
  });

  it("reads the backlog of a queue as the average of its samples", async () => {
    const queue = "00112233445566778899aabbccddeeff";
    const { graphql } = graphqlAnswering(() => ({
      sums: [{ sum: { billableOperations: 6 }, dimensions: { key: queue, t: "2026-11-06T10:30:00Z" } }],
      gauges: [{ avg: { messages: 2.5 }, dimensions: { key: queue, t: "2026-11-06T10:00:00Z" } }],
    }));

    const metrics = await productMetrics(graphql, "queues", "1h", [], NOW);

    expect(metrics.resources[0]?.totals).toEqual({ operations: 6 });
    expect(metrics.resources[0]?.latest).toEqual({ backlog: 2.5 });
  });

  it("keeps the browser time of the whole account as one series", async () => {
    const { graphql } = graphqlAnswering(() => ({
      sums: [{ count: 2, sum: { totalSessionDurationMs: 90_000 }, dimensions: { t: "2026-11-06T10:30:00Z" } }],
    }));

    const metrics = await productMetrics(graphql, "browserRun", "1h", [], NOW);

    expect(metrics.shown).toEqual([""]);
    expect(metrics.resources[0]).toMatchObject({ key: "", totals: { browserMs: 90_000, sessions: 2 } });
  });

  it("counts the queries and the errors of Hyperdrive, and the neurons of each Workers AI model", async () => {
    const config = "aabbccddeeff00112233445566778899";
    const hyperdrive = graphqlAnswering(() => ({
      sums: [
        { count: 7, dimensions: { key: config, status: "complete", t: "2026-11-06T10:30:00Z" } },
        { count: 2, dimensions: { key: config, status: "error", t: "2026-11-06T10:30:00Z" } },
      ],
    }));
    expect((await productMetrics(hyperdrive.graphql, "hyperdrive", "1h", [], NOW)).resources[0]?.totals).toEqual({ queries: 9, errors: 2 });

    const ai = graphqlAnswering(() => ({
      sums: [{ count: 3, sum: { totalNeurons: 120.5 }, dimensions: { key: "@cf/meta/llama-3.1-8b-instruct", t: "2026-11-06T10:30:00Z" } }],
    }));
    expect((await productMetrics(ai.graphql, "workersAi", "1h", [], NOW)).resources[0]?.totals).toEqual({ neurons: 120.5, requests: 3 });
  });

  it("asks only for the days that the analytics of Workflows keep", async () => {
    const { graphql, calls } = graphqlAnswering(() => ({ sums: [] }));
    const metrics = await productMetrics(graphql, "workflows", "90d", [], NOW);
    expect(metrics.times).toHaveLength(90);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.variables["start"]).toBe("2026-10-07T00:00:00Z");
    expect(metrics.sums["steps"]).toEqual({});
  });

  it("asks for a range longer than one query covers in parts", async () => {
    const { graphql, calls } = graphqlAnswering(() => ({ sums: [], stats: [], gauges: [] }));
    await productMetrics(graphql, "d1", "90d", [], NOW);
    expect(calls.length).toBeGreaterThan(1);
    const spans = calls.map((call) => (Date.parse(String(call.variables["end"])) - Date.parse(String(call.variables["start"]))) / 86_400_000);
    expect(Math.max(...spans)).toBeLessThanOrEqual(31);
    expect(spans.reduce((total, days) => total + days, 0)).toBe(90);
  });

  it("asks for each half again when a part reaches the row limit", async () => {
    const { graphql, calls } = graphqlAnswering((call) => {
      const days = (Date.parse(String(call.variables["end"])) - Date.parse(String(call.variables["start"]))) / 86_400_000;
      return { sums: days > 15 ? Array.from({ length: ROW_LIMIT }, () => workerRow("a", "2026-10-10", 1)) : [], stats: [] };
    });
    await productMetrics(graphql, "workers", "30d", [], NOW);
    expect(calls.length).toBe(3);
  });
});
