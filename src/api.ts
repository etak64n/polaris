// Calls the polaris API and turns its errors into messages for the screen.

import type { ApiErrorBody, QueryOrder, TopQueriesResponse, UsageResponse } from "../shared/api.ts";
import type { MetricProduct, MetricRange, MetricsResponse } from "../shared/metrics.ts";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) {
    let message = `The request failed with status ${response.status}.`;
    try {
      const body = (await response.json()) as Partial<ApiErrorBody>;
      if (typeof body.error?.message === "string") message = body.error.message;
    } catch {
      // The response had no JSON body, such as a page from Cloudflare Access.
    }
    throw new ApiError(response.status, message);
  }
  return (await response.json()) as T;
}

export function fetchUsage(days: number, signal: AbortSignal): Promise<UsageResponse> {
  return getJson(`/api/usage?days=${days}`, signal);
}

/** The metrics of a product over a range, with series for the picked resources or the five largest. */
export function fetchMetrics(product: MetricProduct, range: MetricRange, picked: readonly string[], signal: AbortSignal): Promise<MetricsResponse> {
  const params = new URLSearchParams({ product, range });
  for (const key of picked) params.append("resource", key);
  return getJson(`/api/metrics?${params}`, signal);
}

/** The queries of the given databases, or of every database when none is given. */
export function fetchTopQueries(days: number, order: QueryOrder, databaseIds: readonly string[], signal: AbortSignal): Promise<TopQueriesResponse> {
  const params = new URLSearchParams({ days: String(days), order });
  for (const id of databaseIds) params.append("database", id);
  return getJson(`/api/d1/top-queries?${params}`, signal);
}
