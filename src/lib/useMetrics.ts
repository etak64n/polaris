import { useCallback, useEffect, useState } from "react";
import type { MetricProduct, MetricRange, MetricsResponse } from "../../shared/metrics.ts";
import { fetchMetrics } from "@/api.ts";

/** The pick of metrics that have not loaded yet: none. */
const NO_PICK: string[] = [];

/** Metrics with the choice that they answer. */
interface Loaded {
  key: string;
  picked: string[];
  metrics: MetricsResponse;
}

/**
 * Loads the metrics of a product, again whenever the range or the picked resources
 * change, and every `refreshSeconds` while that is set. A tab in the background skips
 * the refresh and catches up when it comes back.
 *
 * The metrics stay until new ones arrive, so a refresh does not empty the screen. They
 * may then answer an earlier choice of the range or the resources: `current` tells
 * whether they answer the choice now, and `metricsPicked` is the pick that they answer.
 */
export function useMetrics(
  product: MetricProduct,
  range: MetricRange,
  picked: string[],
  refreshSeconds: number | null,
): {
  metrics: MetricsResponse | null;
  metricsPicked: string[];
  current: boolean;
  error: string | null;
  loading: boolean;
  refreshCount: number;
  /** Asks again now, such as after a failure. */
  reload: () => void;
} {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  // JSON keeps a pick of the resource without a name, "", apart from no pick at all.
  const pickedKey = JSON.stringify(picked);
  const key = JSON.stringify([product, range, picked]);

  useEffect(() => {
    if (refreshSeconds === null) return;
    let missed = false;
    const refresh = () => setRefreshCount((count) => count + 1);
    const timer = setInterval(() => {
      if (document.hidden) missed = true;
      else refresh();
    }, refreshSeconds * 1000);
    const catchUp = () => {
      if (document.hidden || !missed) return;
      missed = false;
      refresh();
    };
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [refreshSeconds]);

  useEffect(() => {
    const controller = new AbortController();
    const pick = JSON.parse(pickedKey) as string[];
    const requestKey = JSON.stringify([product, range, pick]);
    setError(null);
    setLoading(true);
    fetchMetrics(product, range, pick, controller.signal)
      .then((metrics) => setLoaded({ key: requestKey, picked: pick, metrics }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [product, range, pickedKey, refreshCount]);

  const reload = useCallback(() => setRefreshCount((count) => count + 1), []);

  return {
    metrics: loaded?.metrics ?? null,
    metricsPicked: loaded?.picked ?? NO_PICK,
    current: loaded !== null && loaded.key === key,
    error,
    loading,
    refreshCount,
    reload,
  };
}
