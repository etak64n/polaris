// A product page: a chart for each metric over the picked time range, then every
// resource with its totals.

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { billingPeriod } from "../../shared/dates.ts";
import { refreshSeconds, type MetricProduct, type MetricRange, type MetricResource, type MetricsResponse, type Period } from "../../shared/metrics.ts";
import { AutoRefreshToggle } from "@/components/AutoRefreshToggle.tsx";
import { DataTable } from "@/components/DataTable.tsx";
import { MetricChart } from "@/components/MetricChart.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Panel } from "@/components/Panel.tsx";
import { RangePicker } from "@/components/RangePicker.tsx";
import { ResourceName } from "@/components/ResourceName.tsx";
import { ResourcePicker } from "@/components/ResourcePicker.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { freeLine, type ChartMetric } from "@/lib/free.ts";
import { PERIOD_LABELS, resourceSeries, statisticSeries } from "@/lib/metrics.ts";
import { productColors, type ProductColors } from "@/lib/series.ts";
import { useMetrics } from "@/lib/useMetrics.ts";

export interface ChartDefinition {
  title: string;
  metric: string;
  /** A sum adds up over a period, a quantile shows p50 and p99, and a gauge is a level such as storage. */
  kind: "sum" | "quantile" | "gauge";
  format: (value: number) => string;
  tickFormat?: (value: number) => string;
  /** The free usage of the metric. A daily limit shows only when a period is a day. */
  free?: ChartMetric;
}

export interface ColumnDefinition {
  id: string;
  header: string;
  value: (resource: MetricResource) => number | null;
  format: (value: number) => string;
}

export interface DashboardProps {
  usage: UsageResponse;
  range: MetricRange;
  onRangeChange: (range: MetricRange) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (on: boolean) => void;
}

// Storage is sampled once an hour, so a shorter period shows the hourly samples.
function gaugePeriod(period: Period): Period {
  return period === "1d" ? "1d" : "1h";
}

export function MetricsDashboard({
  usage,
  range,
  onRangeChange,
  autoRefresh,
  onAutoRefreshChange,
  product,
  title,
  plural,
  nameHeader,
  tableTitle,
  labelOf,
  charts,
  columns,
  initialSort,
  children,
}: DashboardProps & {
  product: MetricProduct;
  title: string;
  /** The resources of the product in the picker, such as "Workers" or "databases". */
  plural: string;
  nameHeader: string;
  tableTitle: string;
  labelOf: (key: string, metrics: MetricsResponse) => string;
  charts: ChartDefinition[];
  columns: ColumnDefinition[];
  initialSort: string;
  /** More panels under the table, such as the top queries of D1. They load again when `refreshCount` grows. */
  children?: (context: { colors: ProductColors; picked: string[]; label: (key: string) => string; refreshCount: number }) => ReactNode;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const { metrics, error, loading, refreshCount } = useMetrics(product, range, picked, autoRefresh ? refreshSeconds(range) : null);
  const cycleDays = billingPeriod(usage.today, usage.cycleStartDay).days;
  const label = useMemo(() => (key: string): string => (metrics === null ? key : labelOf(key, metrics)), [metrics, labelOf]);
  const colors = useMemo(
    () => productColors(metrics?.resources.map((resource) => resource.key) ?? [], label, picked),
    [metrics, label, picked],
  );
  const rows = useMemo(
    () => (metrics?.resources ?? []).filter((resource) => picked.length === 0 || picked.includes(resource.key)),
    [metrics, picked],
  );
  const tableColumns = useMemo<ColumnDef<MetricResource>[]>(
    () => [
      {
        id: "name",
        header: nameHeader,
        accessorFn: (row) => label(row.key),
        cell: ({ row }) => <ResourceName color={colors.seriesOf(row.original.key)?.color ?? null} label={label(row.original.key)} title={row.original.key} />,
      },
      ...columns.map(
        (column): ColumnDef<MetricResource> => ({
          id: column.id,
          header: column.header,
          accessorFn: (row) => column.value(row) ?? 0,
          cell: ({ row }) => {
            const value = column.value(row.original);
            return value === null ? "—" : column.format(value);
          },
        }),
      ),
    ],
    [columns, colors, label, nameHeader],
  );

  return (
    <>
      <PageHeader title={title}>
        <ResourcePicker plural={plural} colors={colors} labelOf={label} picked={picked} onChange={setPicked} />
        <RangePicker range={range} onChange={onRangeChange} />
        <AutoRefreshToggle on={autoRefresh} onChange={onAutoRefreshChange} loading={loading} />
      </PageHeader>
      {error !== null && <p className="error-box break-words">{error}</p>}
      {metrics === null ? (
        error === null && (
          <div className="grid gap-6 lg:grid-cols-2">
            {charts.map((chart) => (
              <Skeleton key={`${chart.metric}/${chart.kind}`} className="h-72" />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {charts.map((chart) => {
              const period = chart.kind === "gauge" ? gaugePeriod(metrics.period) : metrics.period;
              const statistic = chart.kind === "sum" ? "Sum" : chart.kind === "quantile" ? "p50 · p99" : "Max";
              const free = chart.free === undefined ? null : freeLine(chart.free, usage.plan, cycleDays);
              return (
                <Panel key={`${chart.metric}/${chart.kind}`} title={chart.title} description={`${statistic} · ${PERIOD_LABELS[period]}`}>
                  <MetricChart
                    label={chart.title}
                    kind={chart.kind === "quantile" ? "lines" : "stacked"}
                    times={metrics.times}
                    period={metrics.period}
                    range={metrics.range}
                    series={
                      chart.kind === "quantile"
                        ? statisticSeries(metrics.quantiles[chart.metric])
                        : resourceSeries(chart.kind === "sum" ? metrics.sums[chart.metric] : metrics.gauges[chart.metric], colors)
                    }
                    format={chart.format}
                    tickFormat={chart.tickFormat}
                    // A daily limit compares with the sum of a day, but a level such as storage compares at any period.
                    line={chart.kind === "sum" && metrics.period !== "1d" ? null : free}
                  />
                </Panel>
              );
            })}
          </div>
          <Panel title={tableTitle}>
            <DataTable
              caption={tableTitle}
              data={rows}
              columns={tableColumns}
              searchText={(row) => `${label(row.key)} ${row.key}`}
              initialSort={[{ id: initialSort, desc: true }]}
            />
          </Panel>
        </>
      )}
      {children?.({ colors, picked, label, refreshCount })}
    </>
  );
}
