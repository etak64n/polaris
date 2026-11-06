// Browser Run: the browser time and the sessions of the whole account over the range.

import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatCount, formatDuration } from "@/lib/format.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Browser time", metric: "browserMs", kind: "sum", format: formatDuration, tickFormat: formatDuration },
  { title: "Sessions", metric: "sessions", kind: "sum", format: formatCount },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "time", header: "Browser time", value: (resource) => resource.totals["browserMs"] ?? 0, format: formatDuration },
  { id: "sessions", header: "Sessions", value: (resource) => resource.totals["sessions"] ?? 0, format: formatCount },
];

// The analytics of Browser Run have no resource but the account.
const labelOf = (key: string): string => (key === "" ? "Account" : key);

export default function BrowserRunPage(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="browserRun"
      title="Browser Run"
      plural="Accounts"
      nameHeader="Account"
      tableTitle="Account"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="time"
    />
  );
}
