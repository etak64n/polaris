// A daily stacked bar chart of one metric, one color per resource. On the Free
// plan, a dashed line marks the daily limit when the bars come near it.

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
import { LIMIT_COLOR } from "@/lib/palette.ts";
import type { ChartRow, Series } from "@/lib/series.ts";

export function UsageChart({
  title,
  rows,
  series,
  format,
  limit = null,
}: {
  title: string;
  rows: ChartRow[];
  series: Series[];
  /** Formats a value for the tooltip. */
  format: (value: number) => string;
  /** The daily limit of the Free plan, or null. */
  limit?: number | null;
}) {
  const config: ChartConfig = Object.fromEntries(series.map((item) => [item.chartKey, { label: item.label, color: item.color }]));
  const dense = rows.length > 60;
  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="font-bold text-heading">{title}</figcaption>
      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap={dense ? 1 : "18%"} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={(date: string) => formatDate(date)} tickLine={false} axisLine={false} minTickGap={28} fontSize={11} />
          <YAxis tickFormatter={(value: number) => formatCompact(value)} tickLine={false} axisLine={false} width={44} allowDecimals={false} fontSize={11} />
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
          {series.length > 1 && <ChartLegend verticalAlign="top" content={<ChartLegendContent className="flex-wrap justify-start pt-0 pb-2" />} />}
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
          {limit !== null && (
            <ReferenceLine
              y={limit}
              stroke={LIMIT_COLOR}
              strokeDasharray="4 3"
              label={{ value: `Free limit ${formatCompact(limit)}`, position: "insideTopRight", fill: LIMIT_COLOR, fontSize: 11 }}
            />
          )}
        </BarChart>
      </ChartContainer>
    </figure>
  );
}
