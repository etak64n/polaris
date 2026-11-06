// The app: loads the usage of the billing cycle, and shows the page that the URL names.
// The product pages load their own metrics for the time range that they share.

import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { UsageResponse } from "../shared/api.ts";
import type { MetricRange } from "../shared/metrics.ts";
import { fetchUsage } from "@/api.ts";
import { Shell } from "@/components/Shell.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFoundPage } from "@/pages/NotFoundPage.tsx";
import { OverviewPage } from "@/pages/OverviewPage.tsx";
import { matchRoute, usePathname, type Route } from "@/router.tsx";

// The pages with charts load after the first paint, because the charts are large.
const WorkersPage = lazy(() => import("@/pages/WorkersPage.tsx"));
const D1Page = lazy(() => import("@/pages/D1Page.tsx"));
const R2Page = lazy(() => import("@/pages/R2Page.tsx"));

const TITLES: Record<Route, string> = { overview: "Overview", workers: "Workers", d1: "D1", r2: "R2", "not-found": "Not found" };

export function App() {
  const route = matchRoute(usePathname());
  const [range, setRange] = useState<MetricRange>("1d");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${TITLES[route]} - polaris`;
  }, [route]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    // The billing cycle, which the cost estimate and the free lines need.
    fetchUsage(controller.signal)
      .then(setUsage)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, []);

  let page: ReactNode;
  if (route === "not-found") page = <NotFoundPage />;
  else if (usage === null) page = error === null ? <LoadingPanels /> : null;
  else if (route === "overview") page = <OverviewPage usage={usage} />;
  else {
    const props = { usage, range, onRangeChange: setRange, autoRefresh, onAutoRefreshChange: setAutoRefresh };
    page = (
      <Suspense fallback={<LoadingPanels />}>
        {route === "workers" && <WorkersPage {...props} />}
        {route === "d1" && <D1Page {...props} />}
        {route === "r2" && <R2Page {...props} />}
      </Suspense>
    );
  }

  return (
    <Shell plan={usage?.plan ?? null}>
      {error !== null && <p className="error-box break-words">{error}</p>}
      {page}
    </Shell>
  );
}

function LoadingPanels() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-6 w-80 rounded-full" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
