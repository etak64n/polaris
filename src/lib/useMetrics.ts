import { useEffect, useState } from "react";
import type { MetricProduct, MetricRange, MetricsResponse } from "../../shared/metrics.ts";
import { fetchMetrics } from "@/api.ts";

/** Loads the metrics of a product, again whenever the range or the picked resources change. */
export function useMetrics(product: MetricProduct, range: MetricRange, picked: string[]): { metrics: MetricsResponse | null; error: string | null } {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickedKey = picked.join("\n");

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetchMetrics(product, range, pickedKey === "" ? [] : pickedKey.split("\n"), controller.signal)
      .then(setMetrics)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => controller.abort();
  }, [product, range, pickedKey]);

  return { metrics, error };
}
