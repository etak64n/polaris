// Workers: the requests, errors, subrequests, and CPU time of every Worker over the range,
// and the handlers of the Workers with the most CPU time.

import { Section } from "@/components/Layout.tsx";
import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { WorkerHandlers } from "@/components/WorkerHandlers.tsx";
import { formatCount, formatDuration } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Requests", help: "The invocations of the Workers: the HTTP requests, and the runs of Cron Triggers and the other handlers.", metric: "requests", kind: "sum", format: formatCount, free: "workerRequests" },
  { title: "Errors", help: "The invocations that failed, such as those that threw an exception or went past a limit.", metric: "errors", kind: "sum", format: formatCount },
  { title: "CPU time per request", help: "The CPU time of one invocation: half of the invocations use less than p50, and 99 in 100 less than p99. CPU time leaves out the time spent waiting, such as for a fetch.", metric: "cpuTimeMs", kind: "quantile", format: formatDuration, tickFormat: formatDuration },
  { title: "Wall time per request", help: "The time from the start to the end of one invocation, at p50 and p99. Unlike CPU time, it counts the time spent waiting, such as for a fetch.", metric: "wallTimeMs", kind: "quantile", format: formatDuration, tickFormat: formatDuration },
  { title: "Subrequests", help: "The requests that the Workers sent while they ran, such as with fetch().", metric: "subrequests", kind: "sum", format: formatCount },
  { title: "CPU time", help: "The CPU time of all the invocations. Workers Paid bills it past 30 million ms a month, and the Free plan limits each invocation to 10 ms instead.", metric: "cpuTimeMs", kind: "sum", format: formatDuration, tickFormat: formatDuration, free: "workerCpuMs" },
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
