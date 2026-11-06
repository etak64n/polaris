// The overview: the estimated
// bill of the billing cycle, and on the Free plan, how much of each daily limit
// today has used.

import { useMemo } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { dailyLimitStatus, estimateCost } from "../../shared/cost.ts";
import { CostSummary } from "@/components/CostSummary.tsx";
import { DailyLimits } from "@/components/DailyLimits.tsx";
import { Section } from "@/components/Layout.tsx";
import { formatDate } from "@/lib/format.ts";

export function OverviewPage({ usage }: { usage: UsageResponse }) {
  const free = usage.plan === "free";
  const estimate = useMemo(() => estimateCost(usage.days, usage.plan, usage.cycleStartDay, usage.today), [usage]);
  const paidEstimate = useMemo(
    () => (free ? estimateCost(usage.days, "paid", usage.cycleStartDay, usage.today) : null),
    [usage, free],
  );
  const today = usage.days.find((day) => day.date === usage.today);
  const { period } = estimate;

  return (
    <>
      {/* The sections carry the large headings. */}
      <h1 className="sr-only">Overview</h1>
      <Section
        large
        title="Cost"
        aside={
          <span className="numeric text-xs text-subdued">
            {formatDate(period.start)} – {formatDate(period.end)}
          </span>
        }
      >
        <CostSummary estimate={estimate} paidEstimate={paidEstimate} />
      </Section>
      {free && today !== undefined && (
        <Section large title="Today (UTC)">
          <DailyLimits statuses={dailyLimitStatus(today)} />
        </Section>
      )}
    </>
  );
}
