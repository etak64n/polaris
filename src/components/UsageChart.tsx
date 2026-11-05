// A daily stacked bar chart of one metric, one color per resource. On the Free
// plan, a dashed line marks the daily limit when the bars come near it.

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, formatDate } from "../lib/format.ts";
import { LIMIT_COLOR } from "../lib/palette.ts";
import type { ChartRow, Series } from "../lib/series.ts";

const AXIS_TEXT = { fontSize: 11, fill: "#68706b" };

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
  const dense = rows.length > 60;
  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-bold text-heading">{title}</span>
        {series.length > 1 && <Legend series={series} />}
      </figcaption>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap={dense ? 1 : "18%"}>
            <CartesianGrid vertical={false} stroke="#e6ebe7" />
            <XAxis
              dataKey="date"
              tickFormatter={(date: string) => formatDate(date)}
              tick={AXIS_TEXT}
              tickLine={false}
              axisLine={{ stroke: "#d9dfda" }}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value)}
              tick={AXIS_TEXT}
              tickLine={false}
              axisLine={false}
              width={44}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(25, 29, 27, 0.05)" }}
              isAnimationActive={false}
              content={(props) => (
                <ChartTooltip active={props.active} row={props.payload?.[0]?.payload as ChartRow | undefined} series={series} format={format} />
              )}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="usage"
                fill={item.color}
                stroke="#ffffff"
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
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {series.map((item) => (
        <li key={item.key} className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: item.color }} />
          <span className="max-w-40 truncate" title={item.label}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function ChartTooltip({
  active,
  row,
  series,
  format,
}: {
  active: boolean | undefined;
  row: ChartRow | undefined;
  series: Series[];
  format: (value: number) => string;
}) {
  if (active !== true || row === undefined) return null;
  const values = series
    .map((item) => ({ item, value: Number(row[item.key] ?? 0) }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value);
  const total = values.reduce((sum, { value }) => sum + value, 0);
  return (
    <div className="panel grid min-w-44 gap-1.5 px-3 py-2 text-xs">
      <div className="font-bold text-heading">{formatDate(row.date)}</div>
      {values.map(({ item, value }) => (
        <div key={item.key} className="flex items-center justify-between gap-4">
          <span className="flex min-w-0 items-center gap-1.5 text-muted">
            <span aria-hidden="true" className="size-2.5 shrink-0" style={{ backgroundColor: item.color }} />
            <span className="max-w-48 truncate">{item.label}</span>
          </span>
          <span className="numeric font-bold text-heading">{format(value)}</span>
        </div>
      ))}
      {values.length > 1 && (
        <div className="flex justify-between gap-4 border-t border-line pt-1.5">
          <span className="text-muted">Total</span>
          <span className="numeric font-bold text-heading">{format(total)}</span>
        </div>
      )}
      {values.length === 0 && <span className="numeric font-bold text-heading">{format(0)}</span>}
    </div>
  );
}
