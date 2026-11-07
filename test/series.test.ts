import { describe, expect, it } from "vitest";
import { OTHER_COLOR, SERIES_COLORS } from "../src/lib/palette.ts";
import { OTHER_KEY, productColors } from "../src/lib/series.ts";

const label = (key: string): string => key.toUpperCase();

describe("productColors", () => {
  it("colors the five largest resources and folds the rest into Other", () => {
    const colors = productColors(["a", "b", "c", "d", "e", "f", "g"], label, []);
    expect(colors.series.map((series) => series.key)).toEqual(["a", "b", "c", "d", "e", OTHER_KEY]);
    expect(colors.series.slice(0, 5).map((series) => series.color)).toEqual([...SERIES_COLORS]);
    expect(colors.series.at(-1)).toEqual({ key: OTHER_KEY, label: "Other", color: OTHER_COLOR });
    expect(colors.seriesOf("b")?.label).toBe("B");
    expect(colors.seriesOf("f")?.key).toBe(OTHER_KEY);
    expect(colors.seriesOf("unknown")).toBeNull();
  });

  it("keeps a resource named other apart from Other", () => {
    const colors = productColors(["other", "b", "c", "d", "e", "f"], label, []);
    expect(colors.series.map((series) => series.key)).toEqual(["other", "b", "c", "d", "e", OTHER_KEY]);
    expect(new Set(colors.series.map((series) => series.key)).size).toBe(6);
    expect(colors.seriesOf("other")?.label).toBe("OTHER");
    expect(colors.seriesOf("f")?.key).toBe(OTHER_KEY);
  });

  it("leaves Other out when every resource has a color", () => {
    const colors = productColors(["a", "b"], label, []);
    expect(colors.series.map((series) => series.key)).toEqual(["a", "b"]);
  });

  it("keeps the color of a picked resource, and gives the others the colors left", () => {
    const colors = productColors(["a", "b", "c", "d", "e", "f"], label, ["x", "c"]);
    expect(colors.series.map((series) => [series.key, series.color])).toEqual([
      ["c", SERIES_COLORS[2]],
      ["x", SERIES_COLORS[0]],
    ]);
    expect(colors.seriesOf("a")).toBeNull();
  });
});
