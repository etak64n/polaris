// Workers: requests and CPU time by day, and every Worker with its totals.

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { FREE_DAILY_LIMITS } from "../../shared/pricing.ts";
import { DataTable } from "@/components/DataTable.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Panel } from "@/components/Panel.tsx";
import { RangeToggle } from "@/components/RangeToggle.tsx";
import { ResourceName } from "@/components/ResourceName.tsx";
import { UsageChart } from "@/components/UsageChart.tsx";
import { formatCount, formatDuration } from "@/lib/format.ts";
import { totalsBy, workerValues, type ResourceTotals } from "@/lib/products.ts";
import { chartRows, productColors } from "@/lib/series.ts";

export default function WorkersPage({ usage, range, onRangeChange }: { usage: UsageResponse; range: number; onRangeChange: (range: number) => void }) {
  const days = useMemo(() => usage.days.slice(-range), [usage, range]);
  const colors = useMemo(() => productColors(days, workerValues, (key) => key), [days]);
  const rows = useMemo(() => totalsBy(days, workerValues), [days]);
  const columns = useMemo<ColumnDef<ResourceTotals>[]>(
    () => [
      {
        id: "name",
        header: "Worker",
        accessorFn: (row) => row.key,
        cell: ({ row }) => <ResourceName color={colors.seriesOf(row.original.key).color} label={row.original.key} title={row.original.key} />,
      },
      { id: "requests", header: "Requests", accessorFn: (row) => row.sums[0] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "cpu", header: "CPU time", accessorFn: (row) => row.sums[1] ?? 0, cell: ({ getValue }) => formatDuration(getValue<number>()) },
    ],
    [colors],
  );

  return (
    <>
      <PageHeader title="Workers">
        <RangeToggle range={range} onChange={onRangeChange} />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Requests">
          <UsageChart
            label="Requests"
            rows={chartRows(days, colors, workerValues, 0)}
            series={colors.series}
            format={formatCount}
            limit={usage.plan === "free" ? FREE_DAILY_LIMITS.workerRequests : null}
          />
        </Panel>
        <Panel title="CPU time">
          <UsageChart label="CPU time" rows={chartRows(days, colors, workerValues, 1)} series={colors.series} format={formatDuration} />
        </Panel>
      </div>
      <Panel title="All Workers">
        <DataTable caption="Workers" data={rows} columns={columns} searchText={(row) => row.key} initialSort={[{ id: "requests", desc: true }]} />
      </Panel>
    </>
  );
}
