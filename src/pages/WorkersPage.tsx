// Workers: requests and CPU time by day, and every Worker with its totals.

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
import { UsageChart } from "@/components/UsageChart.tsx";
import { formatCount, formatDuration } from "@/lib/format.ts";
import { freeLine } from "@/lib/free.ts";
import { totalsBy, workerValues, type ResourceTotals } from "@/lib/products.ts";
import { chartRows, productColors } from "@/lib/series.ts";

const labelOf = (key: string): string => key;

export default function WorkersPage({ usage, range, onRangeChange }: { usage: UsageResponse; range: number; onRangeChange: (range: number) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const days = useMemo(() => usage.days.slice(-range), [usage, range]);
  const colors = useMemo(() => productColors(days, workerValues, labelOf, picked), [days, picked]);
  const cycleDays = billingPeriod(usage.today, usage.cycleStartDay).days;
  const rows = useMemo(
    () => totalsBy(days, workerValues).filter((row) => picked.length === 0 || picked.includes(row.key)),
    [days, picked],
  );
  const columns = useMemo<ColumnDef<ResourceTotals>[]>(
    () => [
      {
        id: "name",
        header: "Worker",
        accessorFn: (row) => row.key,
        cell: ({ row }) => <ResourceName color={colors.seriesOf(row.original.key)?.color ?? null} label={row.original.key} title={row.original.key} />,
      },
      { id: "requests", header: "Requests", accessorFn: (row) => row.sums[0] ?? 0, cell: ({ getValue }) => formatCount(getValue<number>()) },
      { id: "cpu", header: "CPU time", accessorFn: (row) => row.sums[1] ?? 0, cell: ({ getValue }) => formatDuration(getValue<number>()) },
    ],
    [colors],
  );

  return (
    <>
      <PageHeader title="Workers">
        <ResourcePicker plural="Workers" colors={colors} labelOf={labelOf} picked={picked} onChange={setPicked} />
        <RangeToggle range={range} onChange={onRangeChange} />
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Requests">
          <UsageChart
            label="Requests"
            rows={chartRows(days, colors, workerValues, 0)}
            series={colors.series}
            format={formatCount}
            line={freeLine("workerRequests", usage.plan, cycleDays)}
          />
        </Panel>
        <Panel title="CPU time">
          <UsageChart
            label="CPU time"
            rows={chartRows(days, colors, workerValues, 1)}
            series={colors.series}
            format={formatDuration}
            tickFormat={formatDuration}
            line={freeLine("workerCpuMs", usage.plan, cycleDays)}
          />
        </Panel>
      </div>
      <Panel title="By Worker">
        <DataTable caption="Workers" data={rows} columns={columns} searchText={(row) => row.key} initialSort={[{ id: "requests", desc: true }]} />
      </Panel>
    </>
  );
}

