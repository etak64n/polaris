// The overview: the estimated bill of the billing cycle, and on the Free plan,
// how much of each daily limit today has used.

import { useMemo } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { dailyLimitStatus, estimateCost } from "../../shared/cost.ts";
import { CostSummary } from "@/components/CostSummary.tsx";
import { DailyLimits } from "@/components/DailyLimits.tsx";
import { PageHeader } from "@/components/PageHeader.tsx";
import { Panel } from "@/components/Panel.tsx";

export function OverviewPage({ usage }: { usage: UsageResponse }) {
  const free = usage.plan === "free";
  const estimate = useMemo(() => estimateCost(usage.days, usage.plan, usage.cycleStartDay, usage.today), [usage]);
  const paidEstimate = useMemo(
    () => (free ? estimateCost(usage.days, "paid", usage.cycleStartDay, usage.today) : null),
    [usage, free],
  );
  const today = usage.days.find((day) => day.date === usage.today);

  return (
    <>
      <PageHeader title="Overview" />
      <Panel title="Cost">
        <CostSummary estimate={estimate} paidEstimate={paidEstimate} />
      </Panel>
      {free && today !== undefined && (
        <Panel title="Today (UTC)">
          <DailyLimits statuses={dailyLimitStatus(today)} />
        </Panel>
      )}
    </>
  );
}
