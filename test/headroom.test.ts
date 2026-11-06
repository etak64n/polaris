import { describe, expect, it } from "vitest";
import { estimateCost } from "../shared/cost.ts";
import { freeHeadroom } from "../shared/headroom.ts";
import type { DailyUsage } from "../shared/usage.ts";

function day(date: string, requests: number, rowsRead: number, sizes: number[]): DailyUsage {
  return {
    date,
    workers: [{ scriptName: "api", requests, cpuTimeMs: 0 }],
    d1: sizes.map((storageBytes, index) => ({ databaseId: `db-${index}`, rowsRead: index === 0 ? rowsRead : 0, rowsWritten: 0, storageBytes })),
    r2: [{ bucketName: "files", classA: 100_000, classB: 0, storageBytes: 0 }],
  };
}

describe("freeHeadroom", () => {
  const days = [
    day("2026-11-01", 20_000, 1_000_000, [100_000_000, 50_000_000]),
    day("2026-11-02", 60_000, 5_000_000, [120_000_000, 50_000_000]),
    day("2026-11-03", 30_000, 2_000_000, [450_000_000, 50_000_000]),
  ];
  const estimate = estimateCost(days, "free", 1, "2026-11-03");
  const headroom = freeHeadroom(days, 4, estimate.lines);
  const byId = new Map(headroom.map((item) => [item.id, item]));

  it("compares the busiest day with each daily limit", () => {
    expect(byId.get("workers-requests")).toMatchObject({ used: 60_000, limit: 100_000, date: "2026-11-02", past: "stops" });
    expect(byId.get("workers-requests")?.headroom).toBeCloseTo(0.4);
    expect(byId.get("d1-rows-read")).toMatchObject({ used: 5_000_000, date: "2026-11-02", today: 2_000_000, headroom: 0 });
  });

  it("compares the sizes and the number of databases now", () => {
    expect(byId.get("d1-storage")).toMatchObject({ used: 500_000_000, limit: 5_000_000_000, basis: "now" });
    expect(byId.get("d1-largest")).toMatchObject({ used: 450_000_000, limit: 500_000_000 });
    expect(byId.get("d1-largest")?.headroom).toBeCloseTo(0.1);
    expect(byId.get("d1-databases")).toMatchObject({ used: 4, limit: 10 });
  });

  it("projects the free amounts of R2 to the end of the cycle, as amounts that cost money past them", () => {
    const classA = byId.get("r2-class-a-operations");
    expect(classA).toMatchObject({ limit: 1_000_000, basis: "cycle", past: "billed" });
    // 100,000 a day over a cycle of 30 days is 3,000,000.
    expect(classA?.used).toBe(3_000_000);
    expect(classA?.headroom).toBeCloseTo(-2);
  });

  it("puts the least headroom first", () => {
    expect(headroom.map((item) => item.headroom)).toEqual([...headroom.map((item) => item.headroom)].sort((a, b) => a - b));
    expect(headroom[0]?.id).toBe("r2-class-a-operations");
  });
});
