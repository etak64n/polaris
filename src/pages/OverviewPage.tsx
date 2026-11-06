// The overview. On the Free plan
// it starts with the headroom under each limit, which decides whether to pay for
// Workers Paid, and then the estimated bill of the billing cycle.

import { useMemo } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { estimateCost } from "../../shared/cost.ts";
import { freeHeadroom } from "../../shared/headroom.ts";
import { CostSummary } from "@/components/CostSummary.tsx";
import { HeadroomTable } from "@/components/HeadroomTable.tsx";
import { Section } from "@/components/Layout.tsx";
import { formatDate } from "@/lib/format.ts";

export function OverviewPage({ usage }: { usage: UsageResponse }) {
  const free = usage.plan === "free";
  const estimate = useMemo(() => estimateCost(usage.days, usage.plan, usage.cycleStartDay, usage.today), [usage]);
  const paidEstimate = useMemo(
    () => (free ? estimateCost(usage.days, "paid", usage.cycleStartDay, usage.today) : null),
    [usage, free],
  );
  const headroom = useMemo(
    () => freeHeadroom(usage.days, Object.keys(usage.databaseNames).length, estimate.lines),
    [usage, estimate],
  );
  const { period } = estimate;

  return (
    <>
      {/* The sections carry the large headings. */}
      <h1 className="sr-only">Overview</h1>
      {free && (
        <Section large title="Free plan headroom">
          <HeadroomTable items={headroom} />
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
