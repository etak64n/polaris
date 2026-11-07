import { describe, expect, it } from "vitest";
import { freeLine } from "../src/lib/free.ts";

describe("freeLine", () => {
  it("marks the daily limits of the Free plan as limits", () => {
    expect(freeLine("workerRequests", 30)).toEqual({ value: 100_000, label: "Free limit 100K/day", limit: true });
    expect(freeLine("d1RowsRead", 30)).toEqual({ value: 5_000_000, label: "Free limit 5M/day", limit: true });
    expect(freeLine("d1StorageBytes", 30)).toEqual({ value: 5_000_000_000, label: "Free limit 5 GB", limit: true });
  });

  it("draws no line for CPU time, which the Free plan limits per request", () => {
    expect(freeLine("workerCpuMs", 30)).toBeNull();
  });

  it("spreads the monthly free amounts of R2 over the days of the billing cycle", () => {
    const line = freeLine("r2ClassA", 30);
    expect(line?.value).toBeCloseTo(1_000_000 / 30);
    expect(line).toMatchObject({ label: "Free 1M/month (33.3K/day)", limit: false });
    expect(freeLine("r2StorageBytes", 30)).toEqual({ value: 10_000_000_000, label: "Free 10 GB", limit: false });
  });
});
