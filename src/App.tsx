// The page: the header with the range, and the dashboard of the usage of that range.

import { lazy, Suspense, useEffect, useState } from "react";
import { USAGE_DAYS_MIN, type UsageResponse } from "../shared/api.ts";
import { fetchUsage } from "./api.ts";
import { Segmented } from "./components/ui/segmented.tsx";
import { Skeleton } from "./components/ui/skeleton.tsx";

// The charts are the largest part of the app, so they load while the usage loads.
const Dashboard = lazy(() => import("./Dashboard.tsx"));

const RANGES = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

export function App() {
  const [range, setRange] = useState(30);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    // The response always covers the whole billing cycle, which the estimate needs.
    fetchUsage(Math.max(range, USAGE_DAYS_MIN), controller.signal)
      .then(setUsage)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [range]);

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-base font-bold text-heading">
          <img src="/favicon.svg" alt="" className="size-6" />
          polestar
        </h1>
        <div className="flex items-center gap-3">
          {usage !== null && <span className="text-xs font-bold text-muted">{usage.plan === "paid" ? "Workers Paid" : "Workers Free"}</span>}
          <Segmented label="Range" options={RANGES} value={range} onChange={setRange} />
        </div>
      </header>
      <main id="main" className="grid gap-4">
        {error !== null && <p className="error-box break-words">{error}</p>}
        {usage === null ? (
          error === null && <LoadingPanels />
        ) : (
          <Suspense fallback={<LoadingPanels />}>
            <Dashboard usage={usage} range={range} />
          </Suspense>
        )}
      </main>
    </div>
  );
}

function LoadingPanels() {
  return (
    <>
      <Skeleton className="h-48 rounded-ui" />
      <Skeleton className="h-64 rounded-ui" />
      <Skeleton className="h-64 rounded-ui" />
    </>
  );
}
