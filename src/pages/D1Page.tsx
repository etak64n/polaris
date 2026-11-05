// D1: rows read and written and the size by day, every database with its totals,
// and the queries that read or wrote the most rows.

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { FREE_DAILY_LIMITS, GB } from "../../shared/pricing.ts";
import { DataTable } from "@/components/DataTable.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Panel } from "@/components/Panel.tsx";
import { RangeToggle } from "@/components/RangeToggle.tsx";
import { ResourceName } from "@/components/ResourceName.tsx";
import { TopQueries } from "@/components/TopQueries.tsx";
import { UsageChart } from "@/components/UsageChart.tsx";
import { formatBytes, formatCount } from "@/lib/format.ts";
import { d1Values, totalsBy, type ResourceTotals } from "@/lib/products.ts";
import { chartRows, productColors } from "@/lib/series.ts";

export default function D1Page({ usage, range, onRangeChange }: { usage: UsageResponse; range: number; onRangeChange: (range: number) => void }) {
  const free = usage.plan === "free";
  const days = useMemo(() => usage.days.slice(-range), [usage, range]);
  const nameOf = (id: string): string => usage.databaseNames[id] ?? id;
  const colors = useMemo(() => productColors(days, d1Values, (key) => usage.databaseNames[key] ?? key), [days, usage]);
  const rows = useMemo(() => totalsBy(days, d1Values), [days]);
  const columns = useMemo<ColumnDef<ResourceTotals>[]>(
    () => [
      {
        id: "name",
        header: "Database",
        accessorFn: (row) => usage.databaseNames[row.key] ?? row.key,
        cell: ({ row }) => (
          <ResourceName color={colors.seriesOf(row.original.key).color} label={usage.databaseNames[row.original.key] ?? row.original.key} title={row.original.key} />
        ),
      },
      { id: "read", header: "Rows read", accessorFn: (row) => row.sums[0] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "written", header: "Rows written", accessorFn: (row) => row.sums[1] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "storage", header: "Storage", accessorFn: (row) => row.latest[2] ?? 0, cell: ({ getValue }) => formatBytes(getValue<number>()) },
    ],
    [colors, usage],
  );

  return (
    <>
      <PageHeader title="D1">
        <RangeToggle range={range} onChange={onRangeChange} />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Rows read">
          <UsageChart
            label="Rows read"
            rows={chartRows(days, colors, d1Values, 0)}
            series={colors.series}
            format={formatCount}
            limit={free ? FREE_DAILY_LIMITS.d1RowsRead : null}
          />
        </Panel>
        <Panel title="Rows written">
          <UsageChart
            label="Rows written"
            rows={chartRows(days, colors, d1Values, 1)}
            series={colors.series}
            format={formatCount}
            limit={free ? FREE_DAILY_LIMITS.d1RowsWritten : null}
          />
        </Panel>
        <Panel title="Storage (GB)">
          <UsageChart label="Storage" rows={chartRows(days, colors, d1Values, 2, GB)} series={colors.series} format={(value) => formatBytes(value * GB)} />
        </Panel>
      </div>
      <Panel title="All databases">
        <DataTable
          caption="Databases"
          data={rows}
          columns={columns}
          searchText={(row) => `${nameOf(row.key)} ${row.key}`}
          initialSort={[{ id: "read", desc: true }]}
        />
      </Panel>
      <Panel title="Top queries">
        <TopQueries databaseName={nameOf} seriesOf={colors.seriesOf} />
      </Panel>
    </>
  );
}
