// R2: the Class A and Class B operations of every bucket over the range, and its storage and objects.

import { MetricsDashboard, type ChartDefinition, type ColumnDefinition, type DashboardProps } from "@/components/MetricsDashboard.tsx";
import { formatBytes, formatCount } from "@/lib/format.ts";
import { bucketLabel } from "@/lib/labels.ts";

const CHARTS: ChartDefinition[] = [
  { title: "Class A operations", metric: "classA", kind: "sum", format: formatCount, free: "r2ClassA" },
  { title: "Class B operations", metric: "classB", kind: "sum", format: formatCount, free: "r2ClassB" },
  { title: "Storage", metric: "storageBytes", kind: "gauge", format: formatBytes, tickFormat: formatBytes, free: "r2StorageBytes" },
  { title: "Objects", metric: "objects", kind: "gauge", format: formatCount },
];

const COLUMNS: ColumnDefinition[] = [
  { id: "classA", header: "Class A", value: (resource) => resource.totals["classA"] ?? 0, format: formatCount },
  { id: "classB", header: "Class B", value: (resource) => resource.totals["classB"] ?? 0, format: formatCount },
  { id: "storage", header: "Storage", value: (resource) => resource.latest["storageBytes"] ?? null, format: formatBytes },
  { id: "objects", header: "Objects", value: (resource) => resource.latest["objects"] ?? null, format: formatCount },
];

const labelOf = (key: string): string => bucketLabel(key);

export default function R2Page(props: DashboardProps) {
  return (
    <MetricsDashboard
      {...props}
      product="r2"
      title="R2"
      plural="Buckets"
      nameHeader="Bucket"
      tableTitle="By bucket"
      labelOf={labelOf}
      charts={CHARTS}
      columns={COLUMNS}
      initialSort="storage"
    />
  );
}
