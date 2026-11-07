// Durable Objects: the requests, errors, duration, and SQLite rows of every namespace
// over the range, and the data that each stores.

import type { MetricsResponse } from "../../shared/metrics.ts";
import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatBytes, formatCompact, formatCount } from "@/lib/format.ts";

/** Duration in GB-seconds, the unit of its daily limit. */
const formatGbSeconds = (value: number): string => `${formatCompact(value)} GB-s`;

const CHARTS: ChartDefinition[] = [
  { title: "Requests", metric: "requests", kind: "sum", format: formatCount },
  { title: "Errors", metric: "errors", kind: "sum", format: formatCount },
  { title: "Duration", help: "The time that the Durable Objects were active, in GB-seconds: each second counts the 128 MB of memory of an object. The Free plan allows 13,000 GB-s a day.", metric: "gbSeconds", kind: "sum", format: formatGbSeconds, tickFormat: formatGbSeconds },
  { title: "Storage", metric: "storageBytes", kind: "gauge", format: formatBytes, tickFormat: formatBytes },
  { title: "Rows read", help: "The rows that the storage of the Durable Objects read. The key-value methods, such as get(), read rows too.", metric: "rowsRead", kind: "sum", format: formatCount },
  { title: "Rows written", help: "The rows that the storage of the Durable Objects wrote. Deletes and the key-value methods, such as put(), write rows too.", metric: "rowsWritten", kind: "sum", format: formatCount },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "requests", header: "Requests", value: (resource) => resource.totals["requests"] ?? 0, format: formatCount },
  { id: "errors", header: "Errors", value: (resource) => resource.totals["errors"] ?? 0, format: formatCount },
  { id: "duration", header: "Duration", value: (resource) => resource.totals["gbSeconds"] ?? 0, format: formatGbSeconds },
  { id: "read", header: "Rows read", value: (resource) => resource.totals["rowsRead"] ?? 0, format: formatCount },
  { id: "written", header: "Rows written", value: (resource) => resource.totals["rowsWritten"] ?? 0, format: formatCount },
  { id: "storage", header: "Storage", value: (resource) => resource.latest["storageBytes"] ?? null, format: formatBytes },
];

const labelOf = (key: string, metrics: MetricsResponse): string => metrics.names[key] ?? key;

export default function DurableObjectsPage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="durableObjects"
      title="Durable Objects"
      plural="Namespaces"
      nameHeader="Namespace"
      tableTitle="Namespaces"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="requests"
    />
  );
}
