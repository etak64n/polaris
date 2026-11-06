// Workflows: the steps, CPU time, and retries of every Workflow over the range.

import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatCount, formatDuration } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Steps", metric: "steps", kind: "sum", format: formatCount },
  { title: "CPU time", metric: "cpuTimeMs", kind: "sum", format: formatDuration, tickFormat: formatDuration },
  { title: "Retries", metric: "retries", kind: "sum", format: formatCount },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "steps", header: "Steps", value: (resource) => resource.totals["steps"] ?? 0, format: formatCount },
  { id: "cpu", header: "CPU time", value: (resource) => resource.totals["cpuTimeMs"] ?? 0, format: formatDuration },
  { id: "retries", header: "Retries", value: (resource) => resource.totals["retries"] ?? 0, format: formatCount },
];

const labelOf = (key: string): string => key;

export default function WorkflowsPage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="workflows"
      title="Workflows"
      plural="Workflows"
      nameHeader="Workflow"
      tableTitle="Workflows"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="steps"
    />
  );
}
