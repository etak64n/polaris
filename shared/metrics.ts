// Metrics of a time range: the time series of each metric of a product, in periods
// that the length of the range decides.

export const METRIC_RANGES = ["1h", "3h", "12h", "1d", "3d", "1w", "30d", "90d"] as const;
export type MetricRange = (typeof METRIC_RANGES)[number];

export type Period = "1m" | "5m" | "15m" | "1h" | "1d";

export const PERIOD_SECONDS: Record<Period, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86_400 };

/**
 * The length of each range and the period of its points, so that a chart has
 * 30 to 300 points. Cloudflare analytics keep 90 days.
 */
export const RANGE_SPECS: Record<MetricRange, { seconds: number; period: Period }> = {
  "1h": { seconds: 3_600, period: "1m" },
  "3h": { seconds: 10_800, period: "1m" },
  "12h": { seconds: 43_200, period: "5m" },
  "1d": { seconds: 86_400, period: "5m" },
  "3d": { seconds: 259_200, period: "15m" },
  "1w": { seconds: 604_800, period: "1h" },
  "30d": { seconds: 2_592_000, period: "1d" },
  "90d": { seconds: 7_776_000, period: "1d" },
};

/**
 * How long the metrics of a range stay the same: the Worker caches them this long,
 * and the auto refresh of the dashboards asks again at this interval. Cloudflare
 * analytics arrive a minute or more late, so a shorter interval shows nothing new.
 */
export function refreshSeconds(range: MetricRange): number {
  return RANGE_SPECS[range].period === "1m" ? 60 : 300;
}

/** The products with a dashboard of their own, in the order of the sidebar. */
export const METRIC_PRODUCTS = ["workers", "durableObjects", "queues", "workflows", "browserRun", "d1", "r2", "kv", "hyperdrive", "workersAi"] as const;
export type MetricProduct = (typeof METRIC_PRODUCTS)[number];

/** The metrics of each product. Sums add up over a period; quantiles and gauges do not. */
export const PRODUCT_METRICS = {
  workers: { sums: ["requests", "errors", "subrequests", "cpuTimeMs"], quantiles: ["cpuTimeMs", "wallTimeMs"], gauges: [] },
  durableObjects: { sums: ["requests", "errors", "gbSeconds", "rowsRead", "rowsWritten"], quantiles: [], gauges: ["storageBytes"] },
  queues: { sums: ["operations"], quantiles: [], gauges: ["backlog"] },
  workflows: { sums: ["steps", "cpuTimeMs", "retries"], quantiles: [], gauges: [] },
  browserRun: { sums: ["browserMs", "sessions"], quantiles: [], gauges: [] },
  d1: { sums: ["rowsRead", "rowsWritten", "readQueries", "writeQueries"], quantiles: ["queryTimeMs"], gauges: ["storageBytes"] },
  r2: { sums: ["classA", "classB"], quantiles: [], gauges: ["storageBytes", "objects"] },
  kv: { sums: ["reads", "writes", "deletes", "lists"], quantiles: ["latencyMs"], gauges: ["storageBytes", "keys"] },
  hyperdrive: { sums: ["queries", "errors"], quantiles: [], gauges: [] },
  workersAi: { sums: ["neurons", "requests"], quantiles: [], gauges: [] },
} as const satisfies Record<MetricProduct, { sums: readonly string[]; quantiles: readonly string[]; gauges: readonly string[] }>;

export type SumMetric<P extends MetricProduct> = (typeof PRODUCT_METRICS)[P]["sums"][number];
export type QuantileMetric<P extends MetricProduct> = (typeof PRODUCT_METRICS)[P]["quantiles"][number];
export type GaugeMetric<P extends MetricProduct> = (typeof PRODUCT_METRICS)[P]["gauges"][number];

/** The statistics of the quantile metrics. */
export const STATISTICS = ["p50", "p99"] as const;
export type Statistic = (typeof STATISTICS)[number];

/**
 * The series key of the resources that are not shown one by one. The names and IDs of
 * resources never hold parentheses, so a resource named "other" keeps its own series.
 */
export const OTHER_SERIES = "(other)";

/** The most resources that a request can pick. */
export const MAX_PICKED_RESOURCES = 5;

export interface MetricResource {
  key: string;
  /** Each sum metric added up over the range. */
  totals: Record<string, number>;
  /** The last value of each gauge metric in the range, or null when it has none. */
  latest: Record<string, number | null>;
}

export interface MetricsResponse {
  product: MetricProduct;
  range: MetricRange;
  period: Period;
  /** The start of each period, in ISO 8601 UTC, oldest first. The last period is still running. */
  times: string[];
  /** Every resource with any data in the range, the largest first. */
  resources: MetricResource[];
  /** The resources with series of their own: the picked ones, or the five largest. */
  shown: string[];
  /** Per sum metric, per shown resource and OTHER_SERIES, one value per period. */
  sums: Record<string, Record<string, number[]>>;
  /** Per quantile metric, per statistic, one value per period over the picked resources together, or over every resource when none is picked; null where there is no data. */
  quantiles: Record<string, Record<Statistic, (number | null)[]>>;
  /** Per gauge metric, per shown resource and OTHER_SERIES, the largest value in each period, or null. */
  gauges: Record<string, Record<string, (number | null)[]>>;
  /** The names of the resources by their IDs, for the products whose resources have IDs: D1, KV, Durable Objects, Queues, and Hyperdrive. */
  names: Record<string, string>;
}
