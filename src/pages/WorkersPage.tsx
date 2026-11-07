// Workers: the requests, errors, subrequests, and CPU time of every Worker over the range,
// and the handlers of the Workers with the most CPU time.

import { Section } from "@/components/Layout.tsx";
import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { WorkerHandlers } from "@/components/WorkerHandlers.tsx";
import { formatCount, formatDuration } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Requests", metric: "requests", kind: "sum", format: formatCount, free: "workerRequests" },
  { title: "Errors", metric: "errors", kind: "sum", format: formatCount },
  { title: "CPU time per request", metric: "cpuTimeMs", kind: "quantile", format: formatDuration, tickFormat: formatDuration },
  { title: "Wall time per request", metric: "wallTimeMs", kind: "quantile", format: formatDuration, tickFormat: formatDuration },
  { title: "Subrequests", metric: "subrequests", kind: "sum", format: formatCount },
  { title: "CPU time", metric: "cpuTimeMs", kind: "sum", format: formatDuration, tickFormat: formatDuration, free: "workerCpuMs" },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "requests", header: "Requests", value: (resource) => resource.totals["requests"] ?? 0, format: formatCount },
  { id: "errors", header: "Errors", value: (resource) => resource.totals["errors"] ?? 0, format: formatCount },
  { id: "subrequests", header: "Subrequests", value: (resource) => resource.totals["subrequests"] ?? 0, format: formatCount },
  { id: "cpu", header: "CPU time", value: (resource) => resource.totals["cpuTimeMs"] ?? 0, format: formatDuration },
];

const labelOf = (key: string): string => key;

export default function WorkersPage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="workers"
      title="Workers"
      plural="Workers"
      nameHeader="Worker"
      tableTitle="Workers"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="requests"
    >
      {({ colors, picked, refreshCount }) => (
        <Section title="CPU time by handler">
          <WorkerHandlers colorOf={(name) => colors.seriesOf(name)?.color ?? null} scriptNames={picked} refreshCount={refreshCount} />
        </Section>
      )}
    </MetricsDashboard>
  );
}
