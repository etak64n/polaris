import { describe, expect, it } from "vitest";
import { estimateCost } from "../shared/cost.ts";
import { freeLimits } from "../shared/limits.ts";
import type { DailyUsage } from "../shared/usage.ts";

function day(date: string, requests: number, rowsRead: number, sizes: number[], kvWrites = 0, stopped = 0): DailyUsage {
  return {
    date,
    workers: [{ scriptName: "api", requests, cpuTimeMs: 0 }],
    workersStopped: stopped,
    d1: sizes.map((storageBytes, index) => ({ databaseId: `db-${index}`, rowsRead: index === 0 ? rowsRead : 0, rowsWritten: 0, storageBytes })),
    r2: [{ bucketName: "files", classA: 100_000, classB: 0, storageBytes: 0 }],
    kv: { reads: 0, writes: kvWrites, deletes: 0, lists: 0 },
  };
}

describe("freeLimits", () => {
  const days = [
    day("2026-11-01", 20_000, 1_000_000, [100_000_000, 50_000_000], 900),
    day("2026-11-02", 60_000, 5_000_000, [120_000_000, 50_000_000], 100),
    day("2026-11-03", 30_000, 2_000_000, [450_000_000, 50_000_000], 50),
  ];
  const estimate = estimateCost(days, "free", 1, "2026-11-03");
  const limits = freeLimits(days, 4, estimate.lines);
  const byId = new Map([...limits.daily, ...limits.sizes, ...limits.monthly].map((limit) => [limit.id, limit]));

  it("compares the usage of today, the last day, with each daily limit", () => {
    expect(byId.get("workers-requests")).toMatchObject({ used: 30_000, limit: 100_000 });
    expect(byId.get("workers-requests")?.left).toBeCloseTo(0.7);
    expect(byId.get("d1-rows-read")).toMatchObject({ used: 2_000_000, limit: 5_000_000 });
    expect(byId.get("d1-rows-read")?.left).toBeCloseTo(0.6);
    expect(byId.get("kv-lists")).toMatchObject({ used: 0, left: 1 });
  });

  it("leaves every daily limit whole without any day", () => {
    expect(freeLimits([], 0, []).daily.every((limit) => limit.used === 0 && limit.left === 1)).toBe(true);
  });

  it("compares the sizes and the number of databases now", () => {
    expect(limits.sizes.map((limit) => limit.id).sort()).toEqual(["d1-databases", "d1-largest", "d1-storage"]);
    expect(byId.get("d1-storage")).toMatchObject({ used: 500_000_000, limit: 5_000_000_000 });
    expect(byId.get("d1-largest")).toMatchObject({ used: 450_000_000, limit: 500_000_000 });
    expect(byId.get("d1-largest")?.left).toBeCloseTo(0.1);
    expect(byId.get("d1-databases")).toMatchObject({ used: 4, limit: 10 });
  });

  it("compares the KV operations of today with their daily limits", () => {
    expect(byId.get("kv-writes")).toMatchObject({ used: 50, limit: 1_000 });
    expect(byId.get("kv-writes")?.left).toBeCloseTo(0.95);
  });

  it("counts the requests that a limit stopped on any of the days", () => {
    expect(limits.stopped).toBe(0);
    const stoppedDays = [day("2026-11-01", 10, 0, [], 0, 2), day("2026-11-02", 10, 0, [], 0, 3)];
    expect(freeLimits(stoppedDays, 0, []).stopped).toBe(5);
  });

  it("projects the free amounts of R2 to the end of the cycle", () => {
    expect(limits.monthly.map((limit) => limit.id)).toContain("r2-class-a-operations");
    const classA = byId.get("r2-class-a-operations");
    expect(classA).toMatchObject({ item: "Class A operations", limit: 1_000_000 });
    // 100,000 a day over a cycle of 30 days is 3,000,000.
    expect(classA?.used).toBe(3_000_000);
    expect(classA?.left).toBeCloseTo(-2);
  });

  it("puts the limit with the least left first in each group", () => {
    for (const group of [limits.daily, limits.sizes, limits.monthly]) {
      expect(group.map((limit) => limit.left)).toEqual([...group.map((limit) => limit.left)].sort((a, b) => a - b));
    }
    expect(limits.daily[0]?.id).toBe("d1-rows-read");
    expect(limits.monthly[0]?.id).toBe("r2-class-a-operations");
  });
});
