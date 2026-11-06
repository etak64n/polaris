// The overview, in the manner of the home of the Stripe Dashboard. On the Free plan
// it starts with the limits of the plan and the share of each that the usage leaves,
// which decides whether to pay for Workers Paid, and then the estimated bill of the
// billing cycle.

import { useMemo } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { estimateCost } from "../../shared/cost.ts";
import { freeLimits } from "../../shared/limits.ts";
import { CostSummary } from "@/components/CostSummary.tsx";
import { FreeLimits } from "@/components/FreeLimits.tsx";
import { Section } from "@/components/Layout.tsx";
import { formatDate } from "@/lib/format.ts";

export function OverviewPage({ usage }: { usage: UsageResponse }) {
  const free = usage.plan === "free";
  const estimate = useMemo(() => estimateCost(usage.days, usage.plan, usage.cycleStartDay, usage.today), [usage]);
  const paidEstimate = useMemo(
    () => (free ? estimateCost(usage.days, "paid", usage.cycleStartDay, usage.today) : null),
    [usage, free],
  );
  const limits = useMemo(
    () => freeLimits(usage.days, Object.keys(usage.databaseNames).length, estimate.lines),
    [usage, estimate],
  );
  const { period } = estimate;

  return (
    <>
      {/* The sections carry the large headings, as on the home of the Stripe Dashboard. */}
      <h1 className="sr-only">Overview</h1>
      {free && (
        <Section large title="Free plan limits">
          <FreeLimits limits={limits} />
        </Section>
      )}
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
    </>
  );
}
