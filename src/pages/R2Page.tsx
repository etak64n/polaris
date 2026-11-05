// R2: Class A and Class B operations and the size by day, and every bucket with its totals.

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { GB } from "../../shared/pricing.ts";
import { DataTable } from "@/components/DataTable.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Panel } from "@/components/Panel.tsx";
import { RangeToggle } from "@/components/RangeToggle.tsx";
import { ResourceName } from "@/components/ResourceName.tsx";
import { UsageChart } from "@/components/UsageChart.tsx";
import { formatBytes, formatCount } from "@/lib/format.ts";
import { r2Values, totalsBy, type ResourceTotals } from "@/lib/products.ts";
import { chartRows, productColors } from "@/lib/series.ts";

export default function R2Page({ usage, range, onRangeChange }: { usage: UsageResponse; range: number; onRangeChange: (range: number) => void }) {
  const days = useMemo(() => usage.days.slice(-range), [usage, range]);
  const colors = useMemo(() => productColors(days, r2Values, (key) => key), [days]);
  const rows = useMemo(() => totalsBy(days, r2Values), [days]);
  const columns = useMemo<ColumnDef<ResourceTotals>[]>(
    () => [
      {
        id: "name",
        header: "Bucket",
        accessorFn: (row) => row.key,
        cell: ({ row }) => <ResourceName color={colors.seriesOf(row.original.key).color} label={row.original.key} title={row.original.key} />,
      },
      { id: "classA", header: "Class A", accessorFn: (row) => row.sums[0] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "classB", header: "Class B", accessorFn: (row) => row.sums[1] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "storage", header: "Storage", accessorFn: (row) => row.latest[2] ?? 0, cell: ({ getValue }) => formatBytes(getValue<number>()) },
    ],
    [colors],
  );

  return (
    <>
      <PageHeader title="R2">
        <RangeToggle range={range} onChange={onRangeChange} />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Class A operations">
          <UsageChart label="Class A operations" rows={chartRows(days, colors, r2Values, 0)} series={colors.series} format={formatCount} />
        </Panel>
        <Panel title="Class B operations">
          <UsageChart label="Class B operations" rows={chartRows(days, colors, r2Values, 1)} series={colors.series} format={formatCount} />
        </Panel>
        <Panel title="Storage (GB)">
          <UsageChart label="Storage" rows={chartRows(days, colors, r2Values, 2, GB)} series={colors.series} format={(value) => formatBytes(value * GB)} />
        </Panel>
      </div>
      <Panel title="All buckets">
        <DataTable caption="Buckets" data={rows} columns={columns} searchText={(row) => row.key} initialSort={[{ id: "storage", desc: true }]} />
      </Panel>
    </>
  );
}
