// How much of each daily limit of the Free plan today has used. The limits are
// for the whole account and reset at 00:00 UTC.

import { OctagonAlert, TriangleAlert } from "lucide-react";
import type { DailyLimitStatus } from "../../shared/cost.ts";
import type { DailyLimitMetric } from "../../shared/pricing.ts";
import { formatCompact, formatCount, formatPercent } from "../lib/format.ts";
import { cn } from "../lib/utils.ts";

const LABELS: Record<DailyLimitMetric, string> = {
  workerRequests: "Workers requests",
  d1RowsRead: "D1 rows read",
  d1RowsWritten: "D1 rows written",
};

/** A share from which the meter shows the limit as near. */
const NEAR = 0.8;

export function DailyLimits({ statuses }: { statuses: DailyLimitStatus[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {statuses.map((status) => {
        const reached = status.ratio >= 1;
        const near = !reached && status.ratio >= NEAR;
        return (
          <li key={status.metric} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-heading">{LABELS[status.metric]}</span>
              <span className={cn("numeric flex items-center gap-1 font-bold", reached ? "text-danger" : near ? "text-warn" : "text-heading")}>
                {reached && <OctagonAlert aria-hidden="true" className="size-3.5" />}
                {near && <TriangleAlert aria-hidden="true" className="size-3.5" />}
                {formatPercent(status.ratio)}
                {reached && <span className="sr-only">, limit reached</span>}
              </span>
            </div>
            <div
              role="meter"
              aria-label={LABELS[status.metric]}
              aria-valuemin={0}
              aria-valuemax={status.limit}
              aria-valuenow={Math.min(status.used, status.limit)}
              className="h-2 overflow-hidden bg-raised"
            >
              <div
                className={cn("h-full", reached ? "bg-danger" : near ? "bg-warn" : "bg-accent")}
                style={{ width: `${Math.min(100, status.ratio * 100)}%` }}
              />
            </div>
            <div className="numeric text-xs text-muted" title={`${formatCount(status.used)} / ${formatCount(status.limit)}`}>
              {formatCompact(status.used)} / {formatCompact(status.limit)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
