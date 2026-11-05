import { describe, expect, it } from "vitest";
import { addDays, billingPeriod, datesBetween, isDate, monthOf, utcDate } from "../shared/dates.ts";

describe("UTC dates", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-05", -30)).toBe("2026-10-06");
  });

  it("lists every date of a range, both ends included", () => {
    expect(datesBetween("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(datesBetween("2026-03-02", "2026-03-01")).toEqual([]);
  });

  it("takes the date of a moment in UTC", () => {
    expect(utcDate(new Date("2026-11-05T23:59:59Z"))).toBe("2026-11-05");
    expect(utcDate(new Date("2026-11-06T08:59:59+09:00"))).toBe("2026-11-05");
  });

  it("knows real dates", () => {
    expect(isDate("2028-02-29")).toBe(true);
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2026-1-01")).toBe(false);
    expect(monthOf("2026-11-05")).toBe("2026-11");
  });
});

describe("billingPeriod", () => {
  it("starts on the cycle day of the month", () => {
    expect(billingPeriod("2026-11-05", 1)).toEqual({ start: "2026-11-01", end: "2026-11-30", days: 30 });
  });

  it("starts in the previous month before the cycle day", () => {
    expect(billingPeriod("2026-11-05", 14)).toEqual({ start: "2026-10-14", end: "2026-11-13", days: 31 });
  });

  it("starts on the last day of a month that has no cycle day", () => {
    expect(billingPeriod("2026-02-28", 31)).toEqual({ start: "2026-02-28", end: "2026-03-30", days: 31 });
    expect(billingPeriod("2026-02-27", 31)).toEqual({ start: "2026-01-31", end: "2026-02-27", days: 28 });
  });

  it("crosses the end of a year", () => {
    expect(billingPeriod("2027-01-03", 15)).toEqual({ start: "2026-12-15", end: "2027-01-14", days: 31 });
  });
});
