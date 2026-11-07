import { describe, expect, it } from "vitest";
import { formatBytes, formatCompact, formatCount, formatDate, formatDuration, formatMoney, formatPercent } from "../src/lib/format.ts";

describe("formatCount and formatCompact", () => {
  it("writes counts with separators, and short counts with a suffix", () => {
    expect(formatCount(1_234_567)).toBe("1,234,567");
    expect(formatCompact(1_234_567)).toBe("1.2M");
    expect(formatCompact(100_000)).toBe("100K");
    expect(formatCompact(950)).toBe("950");
  });
});

describe("formatMoney", () => {
  it("writes dollars with cents, and an amount under a cent as <$0.01", () => {
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5)).toBe("$5.00");
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney(0.004)).toBe("<$0.01");
  });
});

describe("formatBytes", () => {
  it("writes sizes in decimal units, as Cloudflare bills storage", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1_000)).toBe("1 KB");
    expect(formatBytes(1_500)).toBe("1.5 KB");
    expect(formatBytes(61_800_000)).toBe("61.8 MB");
    expect(formatBytes(412_000_000)).toBe("412 MB");
    expect(formatBytes(5_000_000_000)).toBe("5 GB");
  });
});

describe("formatDuration", () => {
  it("writes time in the largest unit that keeps it above 1", () => {
    expect(formatDuration(2.94)).toBe("2.9 ms");
    expect(formatDuration(10)).toBe("10 ms");
    expect(formatDuration(45)).toBe("45 ms");
    expect(formatDuration(1_500)).toBe("1.5 s");
    expect(formatDuration(90_000)).toBe("1.5 min");
    expect(formatDuration(5_400_000)).toBe("1.5 h");
  });
});

describe("formatDate and formatPercent", () => {
  it("writes dates as YYYY/MM/DD, and shares as whole percents", () => {
    expect(formatDate("2026-11-07")).toBe("2026/11/07");
    expect(formatPercent(0.774)).toBe("77%");
    expect(formatPercent(1)).toBe("100%");
  });
});
