// D1: rows read and written and the size by day, every database with its totals,
// and the queries that read or wrote the most rows.

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { billingPeriod } from "../../shared/dates.ts";
import { DataTable } from "@/components/DataTable.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Panel } from "@/components/Panel.tsx";
import { RangeToggle } from "@/components/RangeToggle.tsx";
import { ResourceName } from "@/components/ResourceName.tsx";
import { ResourcePicker } from "@/components/ResourcePicker.tsx";
import { TopQueries } from "@/components/TopQueries.tsx";
import { UsageChart } from "@/components/UsageChart.tsx";
import { formatBytes, formatCount } from "@/lib/format.ts";
import { freeLine } from "@/lib/free.ts";
import { d1Values, totalsBy, type ResourceTotals } from "@/lib/products.ts";
import { chartRows, productColors } from "@/lib/series.ts";

export default function D1Page({ usage, range, onRangeChange }: { usage: UsageResponse; range: number; onRangeChange: (range: number) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const days = useMemo(() => usage.days.slice(-range), [usage, range]);
  const labelOf = useMemo(() => (id: string): string => usage.databaseNames[id] ?? id, [usage]);
  const colors = useMemo(() => productColors(days, d1Values, labelOf, picked), [days, labelOf, picked]);
  const cycleDays = billingPeriod(usage.today, usage.cycleStartDay).days;
  const rows = useMemo(
    () => totalsBy(days, d1Values).filter((row) => picked.length === 0 || picked.includes(row.key)),
    [days, picked],
  );
  const columns = useMemo<ColumnDef<ResourceTotals>[]>(
    () => [
      {
        id: "name",
        header: "Database",
        accessorFn: (row) => labelOf(row.key),
        cell: ({ row }) => (
          <ResourceName color={colors.seriesOf(row.original.key)?.color ?? null} label={labelOf(row.original.key)} title={row.original.key} />
        ),
      },
      { id: "read", header: "Rows read", accessorFn: (row) => row.sums[0] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "written", header: "Rows written", accessorFn: (row) => row.sums[1] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "storage", header: "Storage", accessorFn: (row) => row.latest[2] ?? 0, cell: ({ getValue }) => formatBytes(getValue<number>()) },
    ],
    [colors, labelOf],
  );

  return (
    <>
      <PageHeader title="D1">
        <ResourcePicker plural="databases" colors={colors} labelOf={labelOf} picked={picked} onChange={setPicked} />
        <RangeToggle range={range} onChange={onRangeChange} />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Rows read">
          <UsageChart
            label="Rows read"
            rows={chartRows(days, colors, d1Values, 0)}
            series={colors.series}
            format={formatCount}
            line={freeLine("d1RowsRead", usage.plan, cycleDays)}
          />
        </Panel>
        <Panel title="Rows written">
          <UsageChart
            label="Rows written"
            rows={chartRows(days, colors, d1Values, 1)}
            series={colors.series}
            format={formatCount}
            line={freeLine("d1RowsWritten", usage.plan, cycleDays)}
          />
        </Panel>
        <div className="grid min-w-0 lg:col-span-2">
          <Panel title="Storage">
            <UsageChart
              label="Storage"
              rows={chartRows(days, colors, d1Values, 2)}
              series={colors.series}
              format={formatBytes}
              tickFormat={formatBytes}
              line={freeLine("d1StorageBytes", usage.plan, cycleDays)}
            />
          </Panel>
        </div>
      </div>
      <Panel title="By database">
        <DataTable
          caption="Databases"
          data={rows}
          columns={columns}
          searchText={(row) => `${labelOf(row.key)} ${row.key}`}
          initialSort={[{ id: "read", desc: true }]}
        />
      </Panel>
      <Panel title="Top queries">
        <TopQueries databaseName={labelOf} colorOf={(id) => colors.seriesOf(id)?.color ?? null} databaseIds={picked} />
      </Panel>
    </>
  );
}
