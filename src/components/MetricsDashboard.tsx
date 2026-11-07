// A product page: the filters under the title, a card for each metric over the picked
// time range in a gray tray, then every resource with its totals.

import type { ColumnDef } from "@tanstack/react-table";
import { ZoomOut } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { billingPeriod } from "../../shared/dates.ts";
import { refreshSeconds, type MetricProduct, type MetricRange, type MetricResource, type MetricsResponse, type Period } from "../../shared/metrics.ts";
import { DataTable } from "@/components/DataTable.tsx";
import { AutoRefreshPill } from "@/components/FilterPill.tsx";
import { Card, Tray } from "@/components/Layout.tsx";
import { MetricChart, type ChartSeries } from "@/components/MetricChart.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { RangePicker } from "@/components/RangePicker.tsx";
import { ResourceName } from "@/components/ResourceName.tsx";
import { ResourcePicker } from "@/components/ResourcePicker.tsx";
import { SeriesLegend } from "@/components/SeriesLegend.tsx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChartGroup } from "@/lib/chart-group.ts";
import { freeLine, type ChartMetric, type FreeLine } from "@/lib/free.ts";
import { PERIOD_LABELS, resourceSeries, statisticSeries, timeLabel } from "@/lib/metrics.ts";
import { MAX_PICKED, productColors, type ProductColors } from "@/lib/series.ts";
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
  /** The resources of the product in the picker, such as "Workers" or "Databases". */
  plural: string;
  nameHeader: string;
  /** Names the table of the resources for screen readers. */
  tableTitle: string;
  labelOf: (key: string, metrics: MetricsResponse) => string;
  charts: ChartDefinition[];
  columns: ColumnDefinition[];
  initialSort: string;
  /** More sections under the table, such as the top queries of D1. They load again when `refreshCount` grows. */
  children?: (context: { colors: ProductColors; picked: string[]; label: (key: string) => string; refreshCount: number }) => ReactNode;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  // Resources that the legend of the page hides in every chart.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const interval = refreshSeconds(range);
  const { metrics, error, loading, refreshCount } = useMetrics(product, range, picked, autoRefresh ? interval : null);
  const { group, zoomed } = useChartGroup();
  const cycleDays = billingPeriod(usage.today, usage.cycleStartDay).days;

  // A new range brings other times, so the charts show all of them again.
  useEffect(() => group.resetZoom(), [group, range]);
  const label = useMemo(() => (key: string): string => (metrics === null ? key : labelOf(key, metrics)), [metrics, labelOf]);
  const colors = useMemo(
    () => productColors(metrics?.resources.map((resource) => resource.key) ?? [], label, picked),
    [metrics, label, picked],
  );
  const rows = metrics?.resources ?? [];

  function toggleHidden(key: string) {
    group.highlight(null);
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  function togglePicked(key: string) {
    setPicked((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }
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

  // The series and the figure of each chart, kept while the metrics stay the same, so
  // that a refresh of the page that changes nothing does not draw the charts again.
  const views = useMemo(() => {
    if (metrics === null) return [];
    const shown = picked.length === 0 ? metrics.resources : metrics.resources.filter((resource) => picked.includes(resource.key));
    return charts.map((chart): ChartView => {
      const free = chart.free === undefined || !usage.freeLimitLines ? null : freeLine(chart.free, cycleDays);
      // A daily limit compares with the sum of a day, but a level such as storage compares at any period.
      const line = chart.kind === "sum" && metrics.period !== "1d" ? null : free;
      // The line shows on the chart once the usage comes near it. Far under it, the
      // line would flatten the usage to the bottom, so the card names the free amount.
      const placed = (series: ChartSeries[]): { line: FreeLine | null; freeNote?: string } =>
        line === null ? { line: null } : peakOf(series) >= line.value * NEAR_LINE ? { line } : { line: null, freeNote: line.label };
      if (chart.kind === "sum") {
        const total = shown.reduce((sum, resource) => sum + (resource.totals[chart.metric] ?? 0), 0);
        const series = resourceSeries(metrics.sums[chart.metric], colors);
        const { line: drawn, freeNote } = placed(series);
        return { chart, series, line: drawn, figure: chart.format(total), note: freeNote };
      }
      if (chart.kind === "gauge") {
        // Storage is a level, so the figure is the latest one, with its time.
        const values = metrics.gauges[chart.metric] ?? {};
        const at = lastIndex(metrics.times.length, (index) => shown.some((resource) => values[resource.key]?.[index] != null));
        const latest = shown.reduce((sum, resource) => sum + (resource.latest[chart.metric] ?? 0), 0);
        const series = resourceSeries(values, colors);
        const { line: drawn, freeNote } = placed(series);
        const asOf = at === null ? undefined : `As of ${timeLabel(metrics.times[at] ?? "", gaugePeriod(metrics.period))}`;
        return {
          chart,
          series,
          line: drawn,
          figure: at === null ? "—" : chart.format(latest),
          note: [asOf, freeNote].filter((part) => part !== undefined).join(" · ") || undefined,
        };
      }
      // A quantile does not add up over a range, so the figure is the latest p99, with p50
      // beside it. Each carries the color of its line, so the figure is the legend too.
      const values = metrics.quantiles[chart.metric];
      const series = statisticSeries(values);
      const at = lastIndex(metrics.times.length, (index) => values?.p99[index] != null);
      const p99 = at === null ? null : (values?.p99[at] ?? null);
      const p50 = at === null ? null : (values?.p50[at] ?? null);
      const [p99Line, p50Line] = series;
      return {
        chart,
        line: null,
        series,
        figure:
          p99 === null ? (
            "—"
          ) : (
            <>
              <span className="inline-flex items-baseline gap-1.5">
                <span aria-hidden="true" className="size-2.5 self-center" style={{ backgroundColor: p99Line?.color }} />
                {chart.format(p99)}
                <span className="text-sm font-semibold text-label">p99</span>
              </span>
              {p50 !== null && (
                <span className="inline-flex items-baseline gap-1.5 text-sm font-normal text-label">
                  <span aria-hidden="true" className="size-2.5 self-center" style={{ backgroundColor: p50Line?.color }} />
                  {chart.format(p50)} p50
                </span>
              )}
            </>
          ),
        note: at === null ? undefined : `As of ${timeLabel(metrics.times[at] ?? "", metrics.period)}`,
      };
    });
  }, [metrics, charts, colors, picked, usage.freeLimitLines, cycleDays]);

  return (
    <>
      <div className="grid gap-2">
        <PageHeader
          title={title}
          filters={
            <>
              <RangePicker range={range} onChange={onRangeChange} />
              <ResourcePicker plural={plural} colors={colors} labelOf={label} picked={picked} onChange={setPicked} />
              <AutoRefreshPill on={autoRefresh} onChange={onAutoRefreshChange} interval={`Every ${PERIOD_LABELS[interval === 60 ? "1m" : "5m"]}`} loading={loading} />
            </>
          }
          actions={
            zoomed ? (
              <Button variant="outline" size="sm" onClick={() => group.resetZoom()}>
                <ZoomOut aria-hidden="true" />
                Reset zoom
              </Button>
            ) : undefined
          }
        />
        {error !== null && <p className="error-box break-words">{error}</p>}
        {metrics === null ? (
          error === null && (
            <Tray>
              {charts.map((chart) => (
                <Skeleton key={`${chart.metric}/${chart.kind}`} className="h-80 rounded-lg bg-card" />
              ))}
            </Tray>
          )
        ) : (
          <>
            <SeriesLegend series={colors.series} hidden={hidden} onToggle={toggleHidden} onPoint={(key) => group.highlight(key)} />
            <Tray>
              {views.map(({ chart, series, line, figure, note }) => (
                <Card key={`${chart.metric}/${chart.kind}`} title={chart.title} figure={figure} note={note}>
                  <MetricChart
                    label={chart.title}
                    kind={chart.kind === "quantile" ? "lines" : "stacked"}
                    times={metrics.times}
                    period={metrics.period}
                    series={series}
                    format={chart.format}
                    tickFormat={chart.tickFormat}
                    line={line}
                    group={group}
                    // Charts of resources follow the legend of the page; the figure of a chart of
                    // p50 and p99 names the colors of its lines.
                    hidden={chart.kind === "quantile" ? NONE_HIDDEN : hidden}
                  />
                </Card>
              ))}
            </Tray>
          </>
        )}
      </div>
      {metrics !== null && (
        // Every resource with its totals over the range. A checked resource shows in the
        // charts on its own, as in the picker; with none checked, the charts show all.
        <DataTable
          caption={tableTitle}
          data={rows}
          columns={tableColumns}
          searchText={(row) => `${label(row.key)} ${row.key}`}
          initialSort={[{ id: initialSort, desc: true }]}
          selection={{
            label: `Show in the charts`,
            isSelected: (row) => picked.includes(row.key),
            canSelect: () => picked.length < MAX_PICKED,
            toggle: (row) => togglePicked(row.key),
            rowLabel: (row) => `Show ${label(row.key)} in the charts`,
          }}
        />
      )}
      {children?.({ colors, picked, label, refreshCount })}
    </>
  );
}

const NONE_HIDDEN: ReadonlySet<string> = new Set();

/** The share of a free line that the usage reaches before the chart draws the line. */
const NEAR_LINE = 0.25;

/** The highest total of the stacked series at any time. */
function peakOf(series: ChartSeries[]): number {
  const count = Math.max(0, ...series.map((item) => item.values.length));
  let peak = 0;
  for (let index = 0; index < count; index += 1) {
    peak = Math.max(peak, series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
  }
  return peak;
}

/** The last position from which `has` holds, or null when it holds nowhere. */
function lastIndex(count: number, has: (index: number) => boolean): number | null {
  for (let index = count - 1; index >= 0; index -= 1) if (has(index)) return index;
  return null;
}

interface ChartView {
  chart: ChartDefinition;
  series: ChartSeries[];
  line: FreeLine | null;
  /** The figure under the name of the chart: the total over the range, or the latest value. */
  figure: ReactNode;
  /** The time of a latest value. */
  note?: string;
}
