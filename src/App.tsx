// The app: loads the usage of the billing cycle, and shows the page that the URL names.
// The product pages load their own metrics for the time range that they share.

import { lazy, Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import type { UsageResponse } from "../shared/api.ts";
import type { MetricProduct, MetricRange } from "../shared/metrics.ts";
import type { DashboardProps } from "@/components/MetricsDashboard.tsx";
import { PRODUCT_NAMES } from "@/lib/products.ts";
import { fetchUsage } from "@/api.ts";
import { Shell } from "@/components/Shell.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFoundPage } from "@/pages/NotFoundPage.tsx";
import { OverviewPage } from "@/pages/OverviewPage.tsx";
import { matchRoute, usePathname, type Route } from "@/router.tsx";

// The pages with charts load after the first paint, because the charts are large.
const PAGES: Record<MetricProduct, LazyExoticComponent<ComponentType<DashboardProps>>> = {
  workers: lazy(() => import("@/pages/WorkersPage.tsx")),
  durableObjects: lazy(() => import("@/pages/DurableObjectsPage.tsx")),
  queues: lazy(() => import("@/pages/QueuesPage.tsx")),
  workflows: lazy(() => import("@/pages/WorkflowsPage.tsx")),
  browserRun: lazy(() => import("@/pages/BrowserRunPage.tsx")),
  d1: lazy(() => import("@/pages/D1Page.tsx")),
  r2: lazy(() => import("@/pages/R2Page.tsx")),
  kv: lazy(() => import("@/pages/KvPage.tsx")),
  hyperdrive: lazy(() => import("@/pages/HyperdrivePage.tsx")),
  workersAi: lazy(() => import("@/pages/WorkersAiPage.tsx")),
};

const TITLES: Record<Route, string> = { overview: "Overview", ...PRODUCT_NAMES, "not-found": "Not found" };

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
    const Page = PAGES[route];
    page = (
      <Suspense fallback={<LoadingPanels />}>
        <Page usage={usage} range={range} onRangeChange={setRange} autoRefresh={autoRefresh} onAutoRefreshChange={setAutoRefresh} />
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
