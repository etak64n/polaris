// Hyperdrive: the queries of every configuration over the range, and those that failed.

import type { MetricsResponse } from "../../shared/metrics.ts";
import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatCount } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Queries", metric: "queries", kind: "sum", format: formatCount },
  { title: "Errors", metric: "errors", kind: "sum", format: formatCount },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "queries", header: "Queries", value: (resource) => resource.totals["queries"] ?? 0, format: formatCount },
  { id: "errors", header: "Errors", value: (resource) => resource.totals["errors"] ?? 0, format: formatCount },
];

const labelOf = (key: string, metrics: MetricsResponse): string => metrics.names[key] ?? key;

export default function HyperdrivePage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="hyperdrive"
      title="Hyperdrive"
      plural="Configurations"
      nameHeader="Configuration"
      tableTitle="Configurations"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="queries"
    />
  );
}
