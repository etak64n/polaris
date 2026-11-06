// A chart of one metric over the range, as a CloudWatch widget: a stacked area of
// the resources for sums and storage, or a line for each statistic of a quantile.
// A dashed line marks the free usage where the plan has one, and the value axis
// always reaches up to it.

import type { ReactElement } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { MetricRange, Period } from "../../shared/metrics.ts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompact } from "@/lib/format.ts";
import type { FreeLine } from "@/lib/free.ts";
import { timeLabel, timeTick } from "@/lib/metrics.ts";
import { LIMIT_COLOR, LINE_COLOR } from "@/lib/palette.ts";

export interface ChartSeries {
  /** A short key for the chart data and its CSS variable, such as s0, other, or p99. */
  chartKey: string;
  label: string;
  color: string;
  /** One value per period, or null where the period has none. */
  values: (number | null)[];
}

export function MetricChart({
  label,
  kind,
  times,
  period,
  range,
  series,
  format,
  tickFormat = formatCompact,
  line = null,
}: {
  /** Names the chart for screen readers. The panel around it shows the same name. */
  label: string;
  /** "stacked" adds the series up; "lines" draws each one on its own, such as p50 and p99. */
  kind: "stacked" | "lines";
  times: string[];
  period: Period;
  range: MetricRange;
  series: ChartSeries[];
  /** Formats a value for the tooltip, such as a count or a size. */
  format: (value: number) => string;
  /** Formats the ticks of the value axis. Counts use short numbers such as 1.2M. */
  tickFormat?: (value: number) => string;
  /** The free usage, or null when the metric has none at this period. */
  line?: FreeLine | null;
}) {
  const config: ChartConfig = Object.fromEntries(series.map((item) => [item.chartKey, { label: item.label, color: item.color }]));
  const rows = times.map((time, index) => {
    const row: Record<string, string | number | null> = { time };
    for (const item of series) row[item.chartKey] = item.values[index] ?? null;
    return row;
  });
  // The label of the line goes on the side with more room: under a line in the upper
  // half of the chart, where the legend is above it, and over a line in the lower half.
  const highest = Math.max(
    0,
    ...times.map((_, index) =>
      kind === "stacked"
        ? series.reduce((total, item) => total + (item.values[index] ?? 0), 0)
        : Math.max(0, ...series.map((item) => item.values[index] ?? 0)),
    ),
  );
  const labelBelow = line !== null && line.value > Math.max(highest, line.value) / 2;

  // Recharts reads its parts from the direct children, so they go in as an array.
  const parts: ReactElement[] = [
    <CartesianGrid key="grid" vertical={false} />,
    <XAxis
      key="x"
      dataKey="time"
      tickFormatter={(time: string) => timeTick(time, period, range)}
      tickLine={false}
      axisLine={false}
      minTickGap={40}
      fontSize={11}
    />,
    <YAxis
      key="y"
      tickFormatter={(value: number) => (value === 0 ? "0" : tickFormat(value))}
      tickLine={false}
      axisLine={false}
      width={52}
      fontSize={11}
    />,
    <ChartTooltip
      key="tooltip"
      cursor={false}
      content={(props) => (
        <ChartTooltipContent
          active={props.active}
          label={props.label}
          // Resources without usage in the period stay out of the tooltip.
          payload={props.payload?.filter((item) => item.value !== null && item.value !== undefined && (kind === "lines" || Number(item.value) > 0))}
          labelFormatter={(value) => timeLabel(String(value), period)}
          formatter={(value, name, item) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: item.color }} />
                <span className="max-w-48 truncate">{config[String(name)]?.label ?? String(name)}</span>
              </span>
              <span className="font-mono font-medium text-foreground tabular-nums">{format(Number(value))}</span>
            </div>
          )}
        />
      )}
    />,
  ];
  if (series.length > 1) {
    parts.push(
      <ChartLegend
        key="legend"
        verticalAlign="top"
        // In the order of the series, which puts "Other" last.
        itemSorter={(item) => series.findIndex((entry) => entry.chartKey === item.dataKey)}
        content={<ChartLegendContent className="flex-wrap justify-start pt-0 pb-2" />}
      />,
    );
  }
  if (line !== null) {
    parts.push(
      <ReferenceLine
        key="free"
        y={line.value}
        // Usage far under the line still shows where the line is.
        ifOverflow="extendDomain"
        stroke={line.limit ? LIMIT_COLOR : LINE_COLOR}
        strokeDasharray="4 3"
        label={{ value: line.label, position: labelBelow ? "insideTopLeft" : "insideBottomLeft", fill: line.limit ? LIMIT_COLOR : LINE_COLOR, fontSize: 11 }}
      />,
    );
  }
  const margin = { top: 18, right: 4, bottom: 0, left: 0 };

  return (
    <figure aria-label={label} className="min-w-0">
      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        {kind === "stacked" ? (
          <AreaChart data={rows} margin={margin} accessibilityLayer>
            {parts}
            {series.map((item) => (
              <Area
                key={item.chartKey}
                dataKey={item.chartKey}
                name={item.chartKey}
                type="linear"
                stackId="total"
                stroke={`var(--color-${item.chartKey})`}
                fill={`var(--color-${item.chartKey})`}
                fillOpacity={0.85}
                strokeWidth={1}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={rows} margin={margin} accessibilityLayer>
            {parts}
            {series.map((item) => (
              <Line
                key={item.chartKey}
                dataKey={item.chartKey}
                name={item.chartKey}
                type="linear"
                stroke={`var(--color-${item.chartKey})`}
                strokeWidth={1.75}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        )}
      </ChartContainer>
    </figure>
  );
}
