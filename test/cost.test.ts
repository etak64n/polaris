import { describe, expect, it } from "vitest";
import { estimateCost, type CostEstimate } from "../shared/cost.ts";
import { datesBetween } from "../shared/dates.ts";
import { GB } from "../shared/pricing.ts";
import { emptyDay, type DailyUsage } from "../shared/usage.ts";

interface Amounts {
  requests?: number;
  cpuMs?: number;
  rowsRead?: number;
  rowsWritten?: number;
  d1Bytes?: number;
  classA?: number;
  classB?: number;
  r2Bytes?: number;
}

function day(date: string, amounts: Amounts = {}): DailyUsage {
  return {
    ...emptyDay(date),
    workers: [{ scriptName: "api", requests: amounts.requests ?? 0, cpuTimeMs: amounts.cpuMs ?? 0 }],
    d1: [{ databaseId: "db", rowsRead: amounts.rowsRead ?? 0, rowsWritten: amounts.rowsWritten ?? 0, storageBytes: amounts.d1Bytes ?? 0 }],
    r2: [{ bucketName: "files", classA: amounts.classA ?? 0, classB: amounts.classB ?? 0, storageBytes: amounts.r2Bytes ?? 0 }],
  };
}

function every(from: string, to: string, amounts: Amounts): DailyUsage[] {
  return datesBetween(from, to).map((date) => day(date, amounts));
}

function line(estimate: CostEstimate, product: string, item: string) {
  const found = estimate.lines.find((candidate) => candidate.product === product && candidate.item === item);
  if (found === undefined) throw new Error(`No line for ${product} ${item}.`);
  return found;
}

describe("estimateCost on the Free plan", () => {
  // 400,000 Class A operations a day, from the 1st to the 5th of a cycle of 30 days.
  const estimate = estimateCost(every("2026-11-01", "2026-11-05", { requests: 90_000, classA: 400_000 }), "free", 1, "2026-11-05");

  it("charges nothing for Workers and D1, which have daily limits instead", () => {
    const requests = line(estimate, "Workers", "Requests");
    expect(requests.used).toBe(450_000);
    expect(requests.included).toBeNull();
    expect(requests.cost).toBe(0);
    expect(estimate.subscription).toBe(0);
  });

  it("charges R2 past its monthly free tier", () => {
    const classA = line(estimate, "R2", "Class A operations");
    expect(classA.used).toBe(2_000_000);
    expect(classA.included).toBe(1_000_000);
    expect(classA.cost).toBeCloseTo(4.5);
    expect(estimate.total).toBeCloseTo(4.5);
  });

  it("projects the average full day onto the rest of the cycle", () => {
    // Four full days of 400,000, then 26 more days at that average: 12,000,000 operations.
    const classA = line(estimate, "R2", "Class A operations");
    expect(estimate.completeDays).toBe(4);
    expect(classA.projectedUsed).toBe(12_000_000);
    expect(classA.projectedCost).toBeCloseTo(49.5);
    expect(estimate.projectedTotal).toBeCloseTo(49.5);
  });
});

describe("estimateCost on the Paid plan", () => {
  const estimate = estimateCost(every("2026-11-01", "2026-11-15", { requests: 1_000_000, rowsWritten: 4_000_000 }), "paid", 1, "2026-11-15");

  it("adds the fee and the usage past what the plan includes", () => {
    expect(estimate.subscription).toBe(5);
    expect(line(estimate, "Workers", "Requests").cost).toBeCloseTo(1.5);
    expect(line(estimate, "D1", "Rows written").cost).toBeCloseTo(10);
    expect(estimate.total).toBeCloseTo(16.5);
  });

  it("projects the cost to the end of the cycle", () => {
    expect(line(estimate, "Workers", "Requests").projectedUsed).toBe(30_000_000);
    expect(line(estimate, "D1", "Rows written").projectedUsed).toBe(120_000_000);
    expect(estimate.projectedTotal).toBeCloseTo(5 + 6 + 70);
  });
});

describe("estimateCost of storage", () => {
  it("bills the average size over the cycle, and counts the share of the cycle that has passed", () => {
    const estimate = estimateCost(every("2026-11-01", "2026-11-10", { r2Bytes: 20 * GB }), "free", 1, "2026-11-10");
    const storage = line(estimate, "R2", "Storage");
    expect(storage.used).toBeCloseTo(20);
    expect(storage.projectedCost).toBeCloseTo(0.15);
    expect(storage.cost).toBeCloseTo(0.05);
  });
});

describe("estimateCost of storage before today is sampled", () => {
  it("averages the sizes of the days that Cloudflare has sampled", () => {
    // 20 GB every day from the 1st to the 4th; the 5th has no sample yet.
    const days = [...every("2026-11-01", "2026-11-04", { r2Bytes: 20 * GB }), day("2026-11-05")];
    const storage = line(estimateCost(days, "free", 1, "2026-11-05"), "R2", "Storage");
    expect(storage.used).toBeCloseTo(20);
  });
});

describe("estimateCost of the cycle", () => {
  it("counts only the days of the current billing cycle", () => {
    const days = [day("2026-10-31", { classA: 50_000_000 }), ...every("2026-11-01", "2026-11-02", { classA: 10 })];
    expect(line(estimateCost(days, "free", 1, "2026-11-02"), "R2", "Class A operations").used).toBe(20);
  });

  it("projects nothing before the first full day of the cycle", () => {
    const estimate = estimateCost([day("2026-11-01", { requests: 5 })], "paid", 1, "2026-11-01");
    expect(estimate.completeDays).toBe(0);
    expect(line(estimate, "Workers", "Requests").projectedUsed).toBeNull();
    expect(estimate.projectedTotal).toBeNull();
  });
});
