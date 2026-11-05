import { describe, expect, it } from "vitest";
import { emptyDay } from "../shared/usage.ts";
import { HistoryError, mergeDays, monthKey, UsageHistory } from "../worker/history.ts";
import { recordHistory } from "../worker/record.ts";
import { FakeUsageSource, MemoryBucket, usageOf } from "./support/fakes.ts";

describe("UsageHistory", () => {
  it("has no days for a month without a file", async () => {
    expect(await new UsageHistory(new MemoryBucket()).read("2026-11")).toEqual([]);
  });

  it("writes one file per month and reads it back", async () => {
    const bucket = new MemoryBucket();
    const history = new UsageHistory(bucket);
    const months = await history.record([usageOf("2026-10-31", 1), usageOf("2026-11-01", 2)]);
    expect(months).toEqual(["2026-10", "2026-11"]);
    expect([...bucket.objects.keys()].sort()).toEqual(["daily/2026-10.json", "daily/2026-11.json"]);
    expect(await history.read("2026-11")).toEqual([usageOf("2026-11-01", 2)]);
  });

  it("replaces the recorded days of the same dates and keeps the others", async () => {
    const history = new UsageHistory(new MemoryBucket());
    await history.record([usageOf("2026-11-01", 1), usageOf("2026-11-02", 1)]);
    await history.record([usageOf("2026-11-02", 5), usageOf("2026-11-03", 5)]);
    expect(await history.read("2026-11")).toEqual([usageOf("2026-11-01", 1), usageOf("2026-11-02", 5), usageOf("2026-11-03", 5)]);
  });

  it("refuses a file that is not a history file of its month", async () => {
    const bucket = new MemoryBucket();
    bucket.objects.set(monthKey("2026-11"), JSON.stringify({ format: 1, month: "2026-10", days: [] }));
    bucket.objects.set(monthKey("2026-12"), "{not json");
    const history = new UsageHistory(bucket);
    await expect(history.read("2026-11")).rejects.toThrow(HistoryError);
    await expect(history.read("2026-12")).rejects.toThrow(/is not JSON/);
  });
});

describe("mergeDays", () => {
  it("sorts the days by date", () => {
    expect(mergeDays([emptyDay("2026-11-03")], [emptyDay("2026-11-01")]).map((day) => day.date)).toEqual(["2026-11-01", "2026-11-03"]);
  });
});

describe("recordHistory", () => {
  it("records the 30 complete days before the run", async () => {
    const source = new FakeUsageSource();
    source.usage = (date) => usageOf(date, 1);
    const bucket = new MemoryBucket();
    const result = await recordHistory(source, new UsageHistory(bucket), new Date("2026-11-05T01:00:00Z"));
    expect(result).toEqual({ from: "2026-10-06", to: "2026-11-04", months: ["2026-10", "2026-11"] });
    expect(source.usageCalls).toEqual([{ from: "2026-10-06", to: "2026-11-04" }]);
    const history = new UsageHistory(bucket);
    expect((await history.read("2026-10")).map((day) => day.date)).toHaveLength(26);
    expect((await history.read("2026-11")).map((day) => day.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
  });
});
