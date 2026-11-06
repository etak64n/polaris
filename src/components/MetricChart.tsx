// A chart of one metric over the range: a stacked area of the resources for sums
// and storage, or a line for each statistic of a quantile. A dashed line marks the
// free usage where the plan has one, and the value axis always reaches up to it.
//
// The charts of a page form a group (lib/chart-group.ts): pointing at a time shows
// that time in every chart, and dragging across a chart zooms every chart into the
// times under the drag. The resources share one legend on the page, which hides and
// shows them in every chart; a chart of statistics has its own legend.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Period } from "../../shared/metrics.ts";
import type { ChartGroup } from "@/lib/chart-group.ts";
import { canvasColor, designValue, echarts, type ChartOption, type EChartsType, type LineSeries } from "@/lib/echarts.ts";
import { formatCompact } from "@/lib/format.ts";
import type { FreeLine } from "@/lib/free.ts";
import { axisEndLabel, periodLabel } from "@/lib/metrics.ts";
import { cn } from "cn";

export interface ChartSeries {
  /** The resource, such as a Worker name, "other", or a statistic such as p99. */
  key: string;
  label: string;
  /** A CSS color, such as var(--chart-1). */
  color: string;
  /** One value per period, or null where the period has none. */
  values: (number | null)[];
}

/** The series that draws the free line. It has no legend and no row in the tooltip. */
const FREE_SERIES = "free";

interface OptionInput {
  kind: "stacked" | "lines";
  times: string[];
  period: Period;
  series: ChartSeries[];
  format: (value: number) => string;
  tickFormat: (value: number) => string;
  line: FreeLine | null;
  /** The times that the charts zoomed into, or null for the whole range. */
  zoom: [number, number] | null;
}

export function MetricChart({
  label,
  kind,
  times,
  period,
  series,
  format,
  tickFormat = formatCompact,
  line = null,
  group,
  hidden: hiddenByPage,
}: {
  /** Names the chart for screen readers. The card around it shows the same name. */
  label: string;
  /** "stacked" adds the series up; "lines" draws each one on its own, such as p50 and p99. */
  kind: "stacked" | "lines";
  times: string[];
  period: Period;
  series: ChartSeries[];
  /** Formats a value for the tooltip, such as a count or a size. */
  format: (value: number) => string;
  /** Formats the labels of the value axis. Counts use short numbers such as 1.2M. */
  tickFormat?: (value: number) => string;
  /** The free usage, or null when the metric has none at this period. */
  line?: FreeLine | null;
  group: ChartGroup;
  /** The series that the legend of the page hides. Without it, the chart shows its own legend. */
  hidden?: ReadonlySet<string>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const cursorTaken = useRef(false);
  const [chart, setChart] = useState<EChartsType | null>(null);
  const [hiddenHere, setHiddenHere] = useState<ReadonlySet<string>>(() => new Set());
  const hidden = hiddenByPage ?? hiddenHere;
  const [zoom, setZoom] = useState<[number, number] | null>(null);

  useEffect(() => {
    const element = container.current;
    if (element === null) return;
    const instance = echarts.init(element, null, { renderer: "canvas" });
    instance.group = group.id;
    const leave = group.add(instance);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(element);
    instance.on("datazoom", (event: unknown) => {
      const next = zoomedTimes(event);
      setZoom(next);
      group.setZoomed(next !== null);
    });
    instance.getZr().on("dblclick", () => group.resetZoom());
    cursorTaken.current = false;
    setChart(instance);
    return () => {
      leave();
      observer.disconnect();
      instance.dispose();
      setChart(null);
    };
  }, [group]);

  const visible = useMemo(() => series.filter((item) => !hidden.has(item.key)), [series, hidden]);
  const option = useMemo(
    () => chartOption({ kind, times, period, series: visible, format, tickFormat, line, zoom }),
    [kind, times, period, visible, format, tickFormat, line, zoom],
  );

  useEffect(() => {
    if (chart === null) return;
    chart.setOption(option, { replaceMerge: ["series"] });
    if (!cursorTaken.current) {
      // Dragging across the chart zooms in, without a zoom button to press first.
      chart.dispatchAction({ type: "takeGlobalCursor", key: "dataZoomSelect", dataZoomSelectActive: true }, { silent: true });
      cursorTaken.current = true;
    }
  }, [chart, option]);

  function toggle(key: string) {
    // A hidden series leaves the chart, so it can no longer clear the fading of the others.
    chart?.dispatchAction({ type: "downplay" });
    setHiddenHere((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  // Pointing at a legend entry brings out that resource in every chart of the page.
  function emphasize(key: string, on: boolean) {
    if (!on) chart?.dispatchAction({ type: "downplay" });
    else if (!hidden.has(key)) chart?.dispatchAction({ type: "highlight", seriesId: key });
  }

  return (
    <figure aria-label={label} className="grid min-w-0 gap-2">
      {hiddenByPage === undefined && series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label={`Series of ${label}`}>
          {series.map((item) => {
            const shown = !hidden.has(item.key);
            return (
              <li key={item.key} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={shown}
                  onClick={() => toggle(item.key)}
                  onMouseEnter={() => emphasize(item.key, true)}
                  onMouseLeave={() => emphasize(item.key, false)}
                  onFocus={() => emphasize(item.key, true)}
                  onBlur={() => emphasize(item.key, false)}
                  className={cn(
                    "flex max-w-56 cursor-pointer items-center gap-1.5 rounded-sm text-xs text-label transition-opacity duration-150 hover:text-strong",
                    !shown && "opacity-40",
                  )}
                >
                  <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={container} className="h-48 w-full" />
    </figure>
  );
}

function chartOption({ kind, times, period, series, format, tickFormat, line, zoom }: OptionInput): ChartOption {
  const subdued = canvasColor("var(--ds-text-subdued)");
  const font = designValue("--ds-font");
  const stamps = times.map((time) => Date.parse(time));
  const first = stamps[0] ?? 0;
  const last = stamps.at(-1) ?? first;
  const [from, to] = zoom ?? [first, last];
  const keys = new Map(series.map((item) => [item.key, item]));

  const surface = canvasColor("var(--ds-surface)");
  const lines: LineSeries[] = series.map((item) => {
    const color = canvasColor(item.color);
    return {
      type: "line",
      id: item.key,
      name: item.label,
      data: stamps.map((stamp, index) => [stamp, item.values[index] ?? null]),
      color,
      showSymbol: false,
      symbol: "circle",
      symbolSize: 8,
      connectNulls: true,
      itemStyle: { color, borderColor: surface, borderWidth: 2 },
      // Stacked bands are solid and have no edge lines. Faint bands with colored edges
      // would let the edge of the top band, often an empty "Other", color the whole
      // total, and seams of the page color would wash out spikes one period wide.
      ...(kind === "stacked"
        ? {
            stack: "total",
            areaStyle: { color, opacity: 0.85 },
            lineStyle: { width: 0 },
            emphasis: { focus: "series" },
            blur: { areaStyle: { opacity: 0.2 } },
          }
        : { lineStyle: { width: 2, color }, emphasis: { focus: "series", lineStyle: { width: 2 } }, blur: { lineStyle: { opacity: 0.2 } } }),
    };
  });

  if (line !== null) {
    // The label goes on the side with more room: under a line in the upper half of the chart.
    const highest = Math.max(
      0,
      ...stamps.map((_, index) =>
        kind === "stacked"
          ? series.reduce((total, item) => total + (item.values[index] ?? 0), 0)
          : Math.max(0, ...series.map((item) => item.values[index] ?? 0)),
      ),
    );
    const below = line.value > Math.max(highest, line.value) / 2;
    const color = canvasColor(line.limit ? "var(--ds-critical)" : "var(--ds-text-subdued)");
    // An invisible copy of the line at every time keeps the value axis up to it, even when zoomed.
    lines.push({
      type: "line",
      id: FREE_SERIES,
      data: stamps.map((stamp) => [stamp, line.value]),
      silent: true,
      showSymbol: false,
      symbol: "none",
      lineStyle: { opacity: 0 },
      emphasis: { disabled: true },
      z: 3,
      markLine: {
        silent: true,
        symbol: "none",
        animation: false,
        lineStyle: { color, width: 1, type: [4, 3] },
        label: { position: below ? "insideStartBottom" : "insideStartTop", formatter: line.label, color, fontSize: 12, fontFamily: font },
        emphasis: { disabled: true },
        data: [{ yAxis: line.value }],
      },
    });
  }

  return {
    animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    animationDuration: 400,
    animationDurationUpdate: 300,
    // A day is a UTC date, as Cloudflare analytics count days in UTC.
    useUTC: period === "1d",
    textStyle: { fontFamily: font },
    grid: { left: 4, right: 56, top: 12, bottom: 24 },
    toolbox: {
      show: true,
      itemSize: 0,
      itemGap: 0,
      showTitle: false,
      right: 0,
      top: 0,
      feature: {
        dataZoom: {
          yAxisIndex: false,
          icon: { zoom: "path://", back: "path://" },
          brushStyle: { color: canvasColor("var(--ds-accent)", 0.08), borderColor: canvasColor("var(--ds-accent)", 0.4), borderWidth: 1 },
        },
      },
    },
    tooltip: {
      trigger: "axis",
      confine: true,
      transitionDuration: 0,
      backgroundColor: "transparent",
      borderWidth: 0,
      padding: 0,
      extraCssText: "box-shadow: none; border-radius: 0;",
      axisPointer: {
        type: "line",
        animation: false,
        label: { show: false },
        lineStyle: { color: canvasColor("var(--ds-chart-crosshair)"), width: 1, type: [2, 2] },
      },
      formatter: (params: unknown) => tooltipHtml(params, keys, kind, period, format),
    },
    xAxis: {
      type: "time",
      min: first,
      max: last,
      axisLine: { show: true, lineStyle: { color: canvasColor("var(--ds-chart-baseline)") } },
      axisTick: { show: false },
      splitLine: { show: false },
      // Only the two ends of the range, or of the zoomed span, as in the Stripe Dashboard.
      axisLabel: {
        customValues: [from, to],
        alignMinLabel: "left",
        alignMaxLabel: "right",
        color: subdued,
        fontSize: 12,
        fontFamily: font,
        formatter: (value: number) => axisEndLabel(new Date(value).toISOString(), period, to - from),
      },
    },
    yAxis: {
      type: "value",
      position: "right",
      min: 0,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: canvasColor("var(--ds-chart-grid)"), width: 1 } },
      axisLabel: {
        color: subdued,
        fontSize: 12,
        fontFamily: font,
        margin: 8,
        formatter: (value: number) => (value === 0 ? "0" : tickFormat(value)),
      },
    },
    series: lines,
  };
}

/** The span of time that a datazoom event zoomed into, or null when it shows the whole range again. */
function zoomedTimes(event: unknown): [number, number] | null {
  if (typeof event !== "object" || event === null) return null;
  const record = event as { batch?: unknown[] };
  const item = (Array.isArray(record.batch) ? record.batch[0] : event) as { startValue?: unknown; endValue?: unknown };
  return typeof item.startValue === "number" && typeof item.endValue === "number" ? [item.startValue, item.endValue] : null;
}

interface AxisItem {
  seriesId?: string;
  value?: unknown;
  axisValue?: unknown;
}

/** The tooltip at one time: the time, then one row per series with a value. */
function tooltipHtml(
  params: unknown,
  keys: Map<string, ChartSeries>,
  kind: "stacked" | "lines",
  period: Period,
  format: (value: number) => string,
): string {
  const items = (Array.isArray(params) ? params : [params]) as AxisItem[];
  const time = Number(items[0]?.axisValue);
  if (!Number.isFinite(time)) return "";
  const rows = items.flatMap((item) => {
    const series = item.seriesId === undefined ? undefined : keys.get(item.seriesId);
    const value = Array.isArray(item.value) ? item.value[1] : null;
    // Resources without usage at this time stay out of the tooltip.
    if (series === undefined || typeof value !== "number" || (kind === "stacked" && value <= 0)) return [];
    return [
      `<div class="flex items-center justify-between gap-4">` +
        `<span class="flex min-w-0 items-center gap-1.5"><span class="size-2.5 shrink-0" style="background-color:${series.color}"></span>` +
        `<span class="max-w-48 truncate">${escapeHtml(series.label)}</span></span>` +
        `<span class="numeric font-semibold text-strong">${escapeHtml(format(value))}</span></div>`,
    ];
  });
  if (rows.length === 0) return "";
  return (
    `<div class="min-w-44 rounded-sm bg-popover p-2 text-xs text-foreground shadow-tooltip">` +
    `<div class="text-sm font-semibold text-heading">${escapeHtml(periodLabel(new Date(time).toISOString(), period))}</div>` +
    `<div class="mt-1.5 grid gap-1 border-t border-hairline pt-1.5">${rows.join("")}</div>` +
    `</div>`
  );
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
