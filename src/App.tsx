// The page: the header with the range, and the dashboard of the usage of that range.

import { lazy, Suspense, useEffect, useState } from "react";
import { USAGE_DAYS_MIN, type UsageResponse } from "../shared/api.ts";
import { fetchUsage } from "@/api.ts";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// The charts are the largest part of the app, so they load while the usage loads.
const Dashboard = lazy(() => import("@/Dashboard.tsx"));

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
    <>
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <h1 className="flex min-w-0 items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-7 shrink-0" />
            <span className="truncate text-lg font-bold tracking-tight text-heading">polestar</span>
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            {usage !== null && (
              <span className="hidden text-xs font-bold text-muted-foreground sm:inline">
                {usage.plan === "paid" ? "Workers Paid" : "Workers Free"}
              </span>
            )}
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Range"
              value={String(range)}
              onValueChange={(value) => {
                if (value !== "") setRange(Number(value));
              }}
            >
              {RANGES.map((option) => (
                <ToggleGroupItem key={option.value} value={String(option.value)}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-[1280px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {error !== null && <p className="error-box break-words">{error}</p>}
        {usage === null ? (
          error === null && <LoadingPanels />
        ) : (
          <Suspense fallback={<LoadingPanels />}>
            <Dashboard usage={usage} range={range} />
          </Suspense>
        )}
      </main>
    </>
  );
}

function LoadingPanels() {
  return (
    <>
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </>
  );
}
