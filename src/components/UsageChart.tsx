// A daily stacked bar chart of one metric, one color per resource. A dashed line
// marks the free usage, and the value axis always reaches up to it.

import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCompact, formatDate } from "@/lib/format.ts";
import type { FreeLine } from "@/lib/free.ts";
import { LIMIT_COLOR, LINE_COLOR } from "@/lib/palette.ts";
import type { ChartRow, Series } from "@/lib/series.ts";

export function UsageChart({
  label,
  rows,
  series,
  format,
  tickFormat = formatCompact,
  line,
}: {
  /** Names the chart for screen readers. The panel around it shows the same name. */
  label: string;
  rows: ChartRow[];
  series: Series[];
  /** Formats a value for the tooltip and the axis, such as a count or a size. */
  format: (value: number) => string;
  /** Formats the ticks of the value axis. Counts use short numbers such as 1.2M. */
  tickFormat?: (value: number) => string;
  /** The free usage, or null when the metric has none. */
  line: FreeLine | null;
}) {
  const config: ChartConfig = Object.fromEntries(series.map((item) => [item.chartKey, { label: item.label, color: item.color }]));
  const dense = rows.length > 60;
  // The label of the line goes on the side with more room: under a line in the upper
  // half of the chart, where the legend is above it, and over a line in the lower half.
  const highest = Math.max(0, ...rows.map((row) => series.reduce((total, item) => total + Number(row[item.chartKey] ?? 0), 0)));
  const labelBelow = line !== null && line.value > Math.max(highest, line.value) / 2;
  return (
    <figure aria-label={label} className="min-w-0">
      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        <BarChart data={rows} margin={{ top: 18, right: 4, bottom: 0, left: 0 }} barCategoryGap={dense ? 1 : "18%"} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={(date: string) => formatDate(date)} tickLine={false} axisLine={false} minTickGap={28} fontSize={11} />
          <YAxis tickFormatter={(value: number) => (value === 0 ? "0" : tickFormat(value))} tickLine={false} axisLine={false} width={52} fontSize={11} />
          <ChartTooltip
            cursor={false}
            content={(props) => (
              <ChartTooltipContent
                active={props.active}
                label={props.label}
                // Resources without usage that day stay out of the tooltip.
                payload={props.payload?.filter((item) => Number(item.value) > 0)}
                labelFormatter={(label) => formatDate(String(label))}
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
          />
          {series.length > 1 && (
            <ChartLegend
              verticalAlign="top"
              // In the order of the series, which puts "Other" last.
              itemSorter={(item) => series.findIndex((entry) => entry.chartKey === item.dataKey)}
              content={<ChartLegendContent className="flex-wrap justify-start pt-0 pb-2" />}
            />
          )}
          {series.map((item) => (
            <Bar
              key={item.chartKey}
              dataKey={item.chartKey}
              name={item.chartKey}
              stackId="usage"
              fill={`var(--color-${item.chartKey})`}
              stroke="var(--card)"
              strokeWidth={dense ? 0 : 1}
              isAnimationActive={false}
            />
          ))}
          {line !== null && (
            <ReferenceLine
              y={line.value}
              // Usage far under the line still shows where the line is.
              ifOverflow="extendDomain"
              stroke={line.limit ? LIMIT_COLOR : LINE_COLOR}
              strokeDasharray="4 3"
              label={{ value: line.label, position: labelBelow ? "insideTopLeft" : "insideBottomLeft", fill: line.limit ? LIMIT_COLOR : LINE_COLOR, fontSize: 11 }}
            />
          )}
        </BarChart>
      </ChartContainer>
    </figure>
  );
}
