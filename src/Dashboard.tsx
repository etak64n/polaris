// The dashboard of one usage response: the estimated bill, today's use of the Free
// plan limits, and the daily usage of Workers, D1, and R2 over the selected range.
// The app loads this module after its first paint, because the charts are large.

import { useMemo, type ReactNode } from "react";
import type { UsageResponse } from "../shared/api.ts";
import { dailyLimitStatus, estimateCost } from "../shared/cost.ts";
import { FREE_DAILY_LIMITS, GB } from "../shared/pricing.ts";
import type { DailyUsage } from "../shared/usage.ts";
import { CostSummary } from "@/components/CostSummary.tsx";
import { DailyLimits } from "@/components/DailyLimits.tsx";
import { ResourceTable } from "@/components/ResourceTable.tsx";
import { TopQueries } from "@/components/TopQueries.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsageChart } from "@/components/UsageChart.tsx";
import { formatBytes, formatCount, formatDuration } from "@/lib/format.ts";
import { chartRows, productColors, type ResourceValues } from "@/lib/series.ts";

// The values of each resource in a day, in the order that the charts of the product use them.
const workerValues: ResourceValues = (day) => day.workers.map((item) => ({ key: item.scriptName, values: [item.requests, item.cpuTimeMs] }));
const d1Values: ResourceValues = (day) =>
  day.d1.map((item) => ({ key: item.databaseId, values: [item.rowsRead, item.rowsWritten, item.storageBytes] }));
const r2Values: ResourceValues = (day) =>
  day.r2.map((item) => ({ key: item.bucketName, values: [item.classA, item.classB, item.storageBytes] }));

export default function Dashboard({ usage, range }: { usage: UsageResponse; range: number }) {
  const free = usage.plan === "free";
  const days = useMemo(() => usage.days.slice(-range), [usage, range]);
  const estimate = useMemo(() => estimateCost(usage.days, usage.plan, usage.cycleStartDay, usage.today), [usage]);
  const paidEstimate = useMemo(
    () => (free ? estimateCost(usage.days, "paid", usage.cycleStartDay, usage.today) : null),
    [usage, free],
  );
  const today = usage.days.find((day) => day.date === usage.today);
  const databaseName = (id: string): string => usage.databaseNames[id] ?? id;

  const workers = useMemo(() => productColors(days, workerValues, (key) => key), [days]);
  const d1 = useMemo(() => productColors(days, d1Values, (key) => usage.databaseNames[key] ?? key), [days, usage]);
  const r2 = useMemo(() => productColors(days, r2Values, (key) => key), [days]);

  return (
    <>
      <Panel title="Cost">
        <CostSummary estimate={estimate} paidEstimate={paidEstimate} />
      </Panel>

      {free && today !== undefined && (
        <Panel title="Today (UTC)">
          <DailyLimits statuses={dailyLimitStatus(today)} />
        </Panel>
      )}

      <Panel title="Workers">
        <div className="grid gap-4 lg:grid-cols-2">
          <UsageChart
            title="Requests"
            rows={chartRows(days, workers, workerValues, 0)}
            series={workers.series}
            format={formatCount}
            limit={free ? FREE_DAILY_LIMITS.workerRequests : null}
          />
          <UsageChart title="CPU time" rows={chartRows(days, workers, workerValues, 1)} series={workers.series} format={formatDuration} />
        </div>
        <ResourceTable
          caption="Worker"
          rows={totalsBy(days, workerValues)}
          name={(row) => ({ key: row.key, label: row.key, title: row.key })}
          seriesOf={workers.seriesOf}
          columns={[
            { label: "Requests", value: (row) => row.sums[0] ?? 0, format: formatCount },
            { label: "CPU time", value: (row) => row.sums[1] ?? 0, format: formatDuration },
          ]}
        />
      </Panel>

      <Panel title="D1">
        <div className="grid gap-4 lg:grid-cols-2">
          <UsageChart
            title="Rows read"
            rows={chartRows(days, d1, d1Values, 0)}
            series={d1.series}
            format={formatCount}
            limit={free ? FREE_DAILY_LIMITS.d1RowsRead : null}
          />
          <UsageChart
            title="Rows written"
            rows={chartRows(days, d1, d1Values, 1)}
            series={d1.series}
            format={formatCount}
            limit={free ? FREE_DAILY_LIMITS.d1RowsWritten : null}
          />
          <UsageChart title="Storage (GB)" rows={chartRows(days, d1, d1Values, 2, GB)} series={d1.series} format={formatGb} />
        </div>
        <ResourceTable
          caption="Database"
          rows={totalsBy(days, d1Values)}
          name={(row) => ({ key: row.key, label: databaseName(row.key), title: row.key })}
          seriesOf={d1.seriesOf}
          columns={[
            { label: "Rows read", value: (row) => row.sums[0] ?? 0, format: formatCount },
            { label: "Rows written", value: (row) => row.sums[1] ?? 0, format: formatCount },
            { label: "Storage", value: (row) => row.latest[2] ?? 0, format: formatBytes },
          ]}
        />
        <TopQueries databaseName={databaseName} seriesOf={d1.seriesOf} />
      </Panel>

      <Panel title="R2">
        <div className="grid gap-4 lg:grid-cols-2">
          <UsageChart title="Class A operations" rows={chartRows(days, r2, r2Values, 0)} series={r2.series} format={formatCount} />
          <UsageChart title="Class B operations" rows={chartRows(days, r2, r2Values, 1)} series={r2.series} format={formatCount} />
          <UsageChart title="Storage (GB)" rows={chartRows(days, r2, r2Values, 2, GB)} series={r2.series} format={formatGb} />
        </div>
        <ResourceTable
          caption="Bucket"
          rows={totalsBy(days, r2Values)}
          name={(row) => ({ key: row.key, label: row.key, title: row.key })}
          seriesOf={r2.seriesOf}
          columns={[
            { label: "Class A", value: (row) => row.sums[0] ?? 0, format: formatCount },
            { label: "Class B", value: (row) => row.sums[1] ?? 0, format: formatCount },
            { label: "Storage", value: (row) => row.latest[2] ?? 0, format: formatBytes },
          ]}
        />
      </Panel>
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="shadow-card" aria-label={title} role="region">
      <CardHeader>
        <CardTitle>
          <h2 className="text-xl font-bold text-heading">{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">{children}</CardContent>
    </Card>
  );
}

interface ResourceTotals {
  key: string;
  /** Each value added up over the days. */
  sums: number[];
  /** Each value of the last day that the resource has, for sizes that do not add up. */
  latest: number[];
}

/** Every resource of the days, the largest first by its first value. */
function totalsBy(days: DailyUsage[], values: ResourceValues): ResourceTotals[] {
  const totals = new Map<string, ResourceTotals>();
  for (const day of days) {
    for (const { key, values: dayValues } of values(day)) {
      const entry = totals.get(key) ?? { key, sums: dayValues.map(() => 0), latest: [] };
      dayValues.forEach((value, index) => {
        entry.sums[index] = (entry.sums[index] ?? 0) + value;
      });
      entry.latest = dayValues;
      totals.set(key, entry);
    }
  }
  return [...totals.values()].sort((a, b) => (b.sums[0] ?? 0) - (a.sums[0] ?? 0) || a.key.localeCompare(b.key));
}

function formatGb(value: number): string {
  return formatBytes(value * GB);
}
