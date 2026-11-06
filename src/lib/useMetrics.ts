import { useEffect, useState } from "react";
import type { MetricProduct, MetricRange, MetricsResponse } from "../../shared/metrics.ts";
import { fetchMetrics } from "@/api.ts";

/**
 * Loads the metrics of a product, again whenever the range or the picked resources
 * change, and every `refreshSeconds` while that is set. A tab in the background
 * skips the refresh and catches up when it comes back. The old metrics stay on the
 * screen until the new ones arrive.
 */
export function useMetrics(
  product: MetricProduct,
  range: MetricRange,
  picked: string[],
  refreshSeconds: number | null,
): { metrics: MetricsResponse | null; error: string | null; loading: boolean; refreshCount: number } {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const pickedKey = picked.join("\n");

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
    setError(null);
    setLoading(true);
    fetchMetrics(product, range, pickedKey === "" ? [] : pickedKey.split("\n"), controller.signal)
      .then(setMetrics)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [product, range, pickedKey, refreshCount]);

  return { metrics, error, loading, refreshCount };
}
