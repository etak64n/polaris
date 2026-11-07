// The overview. It starts with the
// limits of the Free plan and the share of each that the usage leaves, on either plan:
// on the Free plan it tells when to pay for Workers Paid, and on Workers Paid whether
// the usage would fit the Free plan again. The estimated bill of the billing cycle follows.

import { useEffect, useMemo, useState } from "react";
import type { UsageResponse } from "../../shared/api.ts";
import { estimateCost } from "../../shared/cost.ts";
import { freeLimits } from "../../shared/limits.ts";
import { fetchUsage } from "@/api.ts";
import { CostSummary } from "@/components/CostSummary.tsx";
import { ErrorMessage } from "@/components/ErrorMessage.tsx";
import { FreeLimits } from "@/components/FreeLimits.tsx";
import { Subscriptions } from "@/components/Subscriptions.tsx";
import { LoadingPanels, Section } from "@/components/Layout.tsx";
import { formatDate } from "@/lib/format.ts";

/** Loads the usage of the billing cycle, which only the overview needs, each time it opens. */
export function OverviewPage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetchUsage(controller.signal)
      .then(setUsage)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [attempt]);

  if (error !== null) return <ErrorMessage message={error} onRetry={() => setAttempt((count) => count + 1)} />;
  if (usage === null) return <LoadingPanels />;
  return <Overview usage={usage} />;
}

function Overview({ usage }: { usage: UsageResponse }) {
  const free = usage.plan === "free";
  const estimate = useMemo(() => estimateCost(usage.days, usage.plan, usage.cycleStartDay, usage.today), [usage]);
  const paidEstimate = useMemo(
    () => (free ? estimateCost(usage.days, "paid", usage.cycleStartDay, usage.today) : null),
    [usage, free],
  );
  const limits = useMemo(
    () => freeLimits(usage.days, Object.keys(usage.databaseNames).length, usage.cronTriggers, estimate.lines),
    [usage, estimate],
  );
  const { period } = estimate;

  return (
    <>
      {/* The sections carry the large headings. */}
      <h1 className="sr-only">Overview</h1>
      <Section large title="Free plan limits">
        <FreeLimits limits={limits} />
      </Section>
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
      <Section large title="Subscriptions">
        <Subscriptions subscriptions={usage.subscriptions} />
      </Section>
    </>
  );
}
