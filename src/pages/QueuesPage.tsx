// Queues: the billable operations of every queue over the range, and the messages that wait.

import type { MetricsResponse } from "../../shared/metrics.ts";
import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatCompact, formatCount } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Operations", metric: "operations", kind: "sum", format: formatCount },
  { title: "Backlog", metric: "backlog", kind: "gauge", format: formatCompact },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "operations", header: "Operations", value: (resource) => resource.totals["operations"] ?? 0, format: formatCount },
  { id: "backlog", header: "Backlog", value: (resource) => resource.latest["backlog"] ?? null, format: formatCompact },
];

const labelOf = (key: string, metrics: MetricsResponse): string => metrics.names[key] ?? key;

export default function QueuesPage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="queues"
      title="Queues"
      plural="Queues"
      nameHeader="Queue"
      tableTitle="Queues"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="operations"
    />
  );
}
