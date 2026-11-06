// The parts of Apache ECharts that the metric charts use. Registering only these
// keeps the rest of ECharts out of the bundle.

import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  GridComponent,
  MarkLineComponent,
  ToolboxComponent,
  TooltipComponent,
  type GridComponentOption,
  type MarkLineComponentOption,
  type ToolboxComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, MarkLineComponent, ToolboxComponent, TooltipComponent, CanvasRenderer]);

export { echarts };
export type EChartsType = echarts.EChartsType;
export type ChartOption = echarts.ComposeOption<
  LineSeriesOption | GridComponentOption | MarkLineComponentOption | ToolboxComponentOption | TooltipComponentOption
>;
export type LineSeries = LineSeriesOption;

const resolved = new Map<string, string>();

/**
 * A CSS color, such as var(--chart-1), as an rgba() color. The charts draw on a
 * canvas, which cannot read CSS variables, so the page resolves them first.
 */
export function canvasColor(color: string, alpha = 1): string {
  const key = `${color}/${alpha}`;
  const known = resolved.get(key);
  if (known !== undefined) return known;
  const probe = document.createElement("span");
  probe.style.color = color;
  probe.style.display = "none";
  document.body.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  // A canvas turns any color that the browser knows, such as oklch(), into red, green, and blue.
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  let value = computed;
  if (context !== null) {
    context.fillStyle = computed;
    context.fillRect(0, 0, 1, 1);
    const [red = 0, green = 0, blue = 0, opacity = 255] = context.getImageData(0, 0, 1, 1).data;
    value = `rgba(${red}, ${green}, ${blue}, ${((opacity / 255) * alpha).toFixed(3)})`;
  }
  resolved.set(key, value);
  return value;
}

/** A CSS variable of the design, such as --ds-font, as the page computes it. */
export function designValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
