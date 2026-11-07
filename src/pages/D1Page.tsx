// D1: the rows and queries of every database over the range, their query time and
// size, and the queries that read or wrote the most rows.

import type { MetricsResponse } from "../../shared/metrics.ts";
import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { Section } from "@/components/Layout.tsx";
import { TopQueries } from "@/components/TopQueries.tsx";
import { formatBytes, formatCount, formatDuration } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Rows read", help: "The rows that the queries read. A query that scans a table reads every row of it, so an index can lower this.", metric: "rowsRead", kind: "sum", format: formatCount, free: "d1RowsRead" },
  { title: "Rows written", help: "The rows that the queries wrote, with the rows of the indexes that the writes updated.", metric: "rowsWritten", kind: "sum", format: formatCount, free: "d1RowsWritten" },
  { title: "Read queries", metric: "readQueries", kind: "sum", format: formatCount },
  { title: "Write queries", metric: "writeQueries", kind: "sum", format: formatCount },
  { title: "Query time", help: "The time that the database spent running each batch of queries, at p50 and p99. It leaves out the time on the network.", metric: "queryTimeMs", kind: "quantile", format: formatDuration, tickFormat: formatDuration },
  { title: "Storage", metric: "storageBytes", kind: "gauge", format: formatBytes, tickFormat: formatBytes, free: "d1StorageBytes" },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "read", header: "Rows read", value: (resource) => resource.totals["rowsRead"] ?? 0, format: formatCount },
  { id: "written", header: "Rows written", value: (resource) => resource.totals["rowsWritten"] ?? 0, format: formatCount },
  { id: "readQueries", header: "Read queries", value: (resource) => resource.totals["readQueries"] ?? 0, format: formatCount },
  { id: "writeQueries", header: "Write queries", value: (resource) => resource.totals["writeQueries"] ?? 0, format: formatCount },
  { id: "storage", header: "Storage", value: (resource) => resource.latest["storageBytes"] ?? null, format: formatBytes },
];

const labelOf = (key: string, metrics: MetricsResponse): string => metrics.names[key] ?? key;

export default function D1Page(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="d1"
      title="D1"
      plural="Databases"
      nameHeader="Database"
      tableTitle="Databases"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="read"
    >
      {({ colors, picked, label, refreshCount }) => (
        <Section title="Top queries">
          <TopQueries databaseName={label} colorOf={(id) => colors.seriesOf(id)?.color ?? null} databaseIds={picked} refreshCount={refreshCount} />
        </Section>
      )}
    </MetricsDashboard>
  );
}
