// The app: loads the settings that every page needs, and shows the page that the URL
// names. The overview loads the usage of the billing cycle, and the product pages load
// their own metrics for the time range that they share.

import { lazy, Suspense, useEffect, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import type { SettingsResponse } from "../shared/api.ts";
import type { MetricProduct, MetricRange } from "../shared/metrics.ts";
import type { DashboardProps } from "@/components/MetricsDashboard.tsx";
import { PRODUCT_NAMES } from "@/lib/products.ts";
import { fetchSettings } from "@/api.ts";
import { ErrorBoundary } from "@/components/ErrorBoundary.tsx";
import { ErrorMessage } from "@/components/ErrorMessage.tsx";
import { LoadingPanels } from "@/components/Layout.tsx";
import { Shell } from "@/components/Shell.tsx";
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
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = `${TITLES[route]} - polaris`;
  }, [route]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    // The plan, the billing cycle, and the free lines, which the pages need.
    fetchSettings(controller.signal)
      .then(setSettings)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [attempt]);

  let page: ReactNode;
  if (route === "not-found") page = <NotFoundPage />;
  else if (settings === null) page = error === null ? <LoadingPanels /> : null;
  else if (route === "overview") page = <OverviewPage />;
  else {
    const Page = PAGES[route];
    page = (
      <Suspense fallback={<LoadingPanels />}>
        <Page settings={settings} range={range} onRangeChange={setRange} autoRefresh={autoRefresh} onAutoRefreshChange={setAutoRefresh} />
      </Suspense>
    );
  }

  return (
    <Shell plan={settings?.plan ?? null}>
      {error !== null && <ErrorMessage message={error} onRetry={() => setAttempt((count) => count + 1)} />}
      {/* A page that crashes leaves the sidebar, and opening another page starts afresh. */}
      <ErrorBoundary key={route} area="page">
        {page}
      </ErrorBoundary>
    </Shell>
  );
}
