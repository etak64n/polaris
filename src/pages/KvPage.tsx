// KV: the reads, writes, deletes, and lists of every namespace over the range, their
// latency, and their size.

import type { MetricsResponse } from "../../shared/metrics.ts";
import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatBytes, formatCount, formatDuration } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Reads", metric: "reads", kind: "sum", format: formatCount },
  { title: "Writes", metric: "writes", kind: "sum", format: formatCount },
  { title: "Deletes", metric: "deletes", kind: "sum", format: formatCount },
  { title: "Lists", metric: "lists", kind: "sum", format: formatCount },
  { title: "Latency", metric: "latencyMs", kind: "quantile", format: formatDuration, tickFormat: formatDuration },
  { title: "Storage", metric: "storageBytes", kind: "gauge", format: formatBytes, tickFormat: formatBytes },
  { title: "Keys", metric: "keys", kind: "gauge", format: formatCount },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "reads", header: "Reads", value: (resource) => resource.totals["reads"] ?? 0, format: formatCount },
  { id: "writes", header: "Writes", value: (resource) => resource.totals["writes"] ?? 0, format: formatCount },
  { id: "deletes", header: "Deletes", value: (resource) => resource.totals["deletes"] ?? 0, format: formatCount },
  { id: "lists", header: "Lists", value: (resource) => resource.totals["lists"] ?? 0, format: formatCount },
  { id: "storage", header: "Storage", value: (resource) => resource.latest["storageBytes"] ?? null, format: formatBytes },
  { id: "keys", header: "Keys", value: (resource) => resource.latest["keys"] ?? null, format: formatCount },
];

const labelOf = (key: string, metrics: MetricsResponse): string => metrics.names[key] ?? key;

export default function KvPage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="kv"
      title="KV"
      plural="Namespaces"
      nameHeader="Namespace"
      tableTitle="Namespaces"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="reads"
    />
  );
}
