// Workers AI: the neurons and the requests of every model over the range.

import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatCount } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Neurons", metric: "neurons", kind: "sum", format: formatCount },
  { title: "Requests", metric: "requests", kind: "sum", format: formatCount },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "neurons", header: "Neurons", value: (resource) => resource.totals["neurons"] ?? 0, format: formatCount },
  { id: "requests", header: "Requests", value: (resource) => resource.totals["requests"] ?? 0, format: formatCount },
];

const labelOf = (key: string): string => key;

export default function WorkersAiPage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="workersAi"
      title="Workers AI"
      plural="Models"
      nameHeader="Model"
      tableTitle="Models"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="neurons"
    />
  );
}
