// The time series of the metrics of a product over a range, from the GraphQL
// Analytics API, for the charts of the product pages.
//
// One query per product asks for every sum and gauge per resource and period,
// and for the quantiles of the picked resources together, per period. Storage
// is sampled once an hour, so periods shorter than an hour take the value of the
// last sample before them.

import {
  MAX_PICKED_RESOURCES,
  OTHER_SERIES,
  PERIOD_SECONDS,
  PRODUCT_METRICS,
  RANGE_SPECS,
  type MetricProduct,
  type MetricRange,
  type MetricResource,
  type MetricsResponse,
  type Period,
  type Statistic,
} from "../shared/metrics.ts";
import { AnalyticsError, ROW_LIMIT, r2Class } from "./analytics.ts";

export type GraphqlFn = <T>(query: string, variables: Record<string, string | string[]>) => Promise<T>;

/** The longest span that one query covers: Cloudflare allows 32 days. */
const MAX_QUERY_SECONDS = 31 * 86_400;

const TIME_FIELD: Record<Period, string> = {
  "1m": "datetimeMinute",
  "5m": "datetimeFiveMinutes",
  "15m": "datetimeFifteenMinutes",
  "1h": "datetimeHour",
  "1d": "date",
};

/** The periods of a range that ends with the period that is running now. */
export interface MetricsWindow {
  period: Period;
  /** The start of each period, ISO 8601 UTC. */
  times: string[];
}

export function metricsWindow(range: MetricRange, now: Date): MetricsWindow {
  const { seconds, period } = RANGE_SPECS[range];
  const step = PERIOD_SECONDS[period] * 1000;
  const end = Math.floor(now.getTime() / step) * step + step;
  const count = Math.round((seconds * 1000) / step);
  return { period, times: Array.from({ length: count }, (_, index) => isoTime(end - (count - index) * step)) };
}

function isoTime(milliseconds: number): string {
  return new Date(milliseconds).toISOString().replace(".000Z", "Z");
}

/** The time of a row as the start of its period: "2026-11-06" becomes "2026-11-06T00:00:00Z". */
function rowTime(value: string): string {
  return value.length === 10 ? `${value}T00:00:00Z` : isoTime(Date.parse(value));
}

interface Row {
  dimensions: Record<string, string>;
  sum?: Record<string, number>;
  quantiles?: Record<string, number>;
  max?: Record<string, number>;
}

interface QueryRows {
  sums: Row[];
  stats: Row[];
  gauges: Row[];
}

// Products with quantiles filter them by the picked resources, and products with
// gauges read storage from an earlier start. GraphQL refuses a declared variable
// that the query does not use, so each query declares only what it uses.
function usesPicked(product: MetricProduct, picked: readonly string[]): boolean {
  return picked.length > 0 && PRODUCT_METRICS[product].quantiles.length > 0;
}

function usesGaugeStart(product: MetricProduct): boolean {
  return PRODUCT_METRICS[product].gauges.length > 0;
}

// The GraphQL query of each product. `t` is the period of a row and `key` its resource.
function productQuery(product: MetricProduct, field: string, gaugeField: string, picked: boolean): string {
  const filter = "datetime_geq: $start, datetime_lt: $end";
  const pickedVariable = picked ? ", $picked: [string!]" : "";
  const gaugeVariable = usesGaugeStart(product) ? ", $gaugeStart: Time!" : "";
  const head = `query PolarisMetrics($accountTag: string!, $start: Time!, $end: Time!${gaugeVariable}${pickedVariable}) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {`;
  const tail = `
    }
  }
}`;
  switch (product) {
    case "workers":
      return `${head}
      sums: workersInvocationsAdaptive(limit: ${ROW_LIMIT}, filter: { ${filter} }) {
        sum { requests errors subrequests cpuTimeUs }
        dimensions { key: scriptName t: ${field} }
      }
      stats: workersInvocationsAdaptive(limit: ${ROW_LIMIT}, filter: { ${filter}${picked ? ", scriptName_in: $picked" : ""} }) {
        quantiles { cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99 }
        dimensions { t: ${field} }
      }${tail}`;
    case "d1":
      return `${head}
      sums: d1AnalyticsAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { ${filter} }) {
        sum { rowsRead rowsWritten readQueries writeQueries }
        dimensions { key: databaseId t: ${field} }
      }
      stats: d1AnalyticsAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { ${filter}${picked ? ", databaseId_in: $picked" : ""} }) {
        quantiles { queryBatchTimeMsP50 queryBatchTimeMsP99 }
        dimensions { t: ${field} }
      }
      gauges: d1StorageAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { datetime_geq: $gaugeStart, datetime_lt: $end }) {
        max { databaseSizeBytes }
        dimensions { key: databaseId t: ${gaugeField} }
      }${tail}`;
    case "r2":
      return `${head}
      sums: r2OperationsAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { ${filter} }) {
        sum { requests }
        dimensions { key: bucketName action: actionType t: ${field} }
      }
      gauges: r2StorageAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { datetime_geq: $gaugeStart, datetime_lt: $end }) {
        max { payloadSize metadataSize objectCount }
        dimensions { key: bucketName t: ${gaugeField} }
      }${tail}`;
  }
}

// The values of a row, by the metric names of shared/metrics.ts.
function sumValues(product: MetricProduct, row: Row): Record<string, number> {
  const sum = row.sum ?? {};
  switch (product) {
    case "workers":
      return {
        requests: sum["requests"] ?? 0,
        errors: sum["errors"] ?? 0,
        subrequests: sum["subrequests"] ?? 0,
        cpuTimeMs: (sum["cpuTimeUs"] ?? 0) / 1000,
      };
    case "d1":
      return {
        rowsRead: sum["rowsRead"] ?? 0,
        rowsWritten: sum["rowsWritten"] ?? 0,
        readQueries: sum["readQueries"] ?? 0,
        writeQueries: sum["writeQueries"] ?? 0,
      };
    case "r2": {
      const operationClass = r2Class(row.dimensions["action"] ?? "");
      const requests = sum["requests"] ?? 0;
      return { classA: operationClass === "A" ? requests : 0, classB: operationClass === "B" ? requests : 0 };
    }
  }
}

function quantileValues(product: MetricProduct, row: Row): Record<string, Record<Statistic, number>> {
  const q = row.quantiles ?? {};
  switch (product) {
    case "workers":
      // Microseconds in the dataset, milliseconds on the dashboard.
      return {
        cpuTimeMs: { p50: (q["cpuTimeP50"] ?? 0) / 1000, p99: (q["cpuTimeP99"] ?? 0) / 1000 },
        wallTimeMs: { p50: (q["wallTimeP50"] ?? 0) / 1000, p99: (q["wallTimeP99"] ?? 0) / 1000 },
      };
    case "d1":
      return { queryTimeMs: { p50: q["queryBatchTimeMsP50"] ?? 0, p99: q["queryBatchTimeMsP99"] ?? 0 } };
    case "r2":
      return {};
  }
}

function gaugeValues(product: MetricProduct, row: Row): Record<string, number> {
  const max = row.max ?? {};
  switch (product) {
    case "workers":
      return {};
    case "d1":
      return { storageBytes: max["databaseSizeBytes"] ?? 0 };
    case "r2":
      return { storageBytes: (max["payloadSize"] ?? 0) + (max["metadataSize"] ?? 0), objects: max["objectCount"] ?? 0 };
  }
}

/** Asks for the rows of the periods, in parts when the range is too long or a part reaches the row limit. */
async function queryRows(
  graphql: GraphqlFn,
  product: MetricProduct,
  window: MetricsWindow,
  times: string[],
  picked: readonly string[],
): Promise<QueryRows> {
  const step = PERIOD_SECONDS[window.period];
  const first = times[0];
  const last = times.at(-1);
  if (first === undefined || last === undefined) return { sums: [], stats: [], gauges: [] };
  const half = Math.ceil(times.length / 2);
  const inHalves = async (): Promise<QueryRows> => {
    const [a, b] = [await queryRows(graphql, product, window, times.slice(0, half), picked), await queryRows(graphql, product, window, times.slice(half), picked)];
    return { sums: [...a.sums, ...b.sums], stats: [...a.stats, ...b.stats], gauges: [...a.gauges, ...b.gauges] };
  };
  if (times.length * step > MAX_QUERY_SECONDS) return inHalves();

  const start = Date.parse(first);
  const end = Date.parse(last) + step * 1000;
  // Storage is sampled hourly, so a short period needs the sample before the range too.
  const gaugeHourly = step < 3600;
  const variables: Record<string, string | string[]> = { start: isoTime(start), end: isoTime(end) };
  if (usesGaugeStart(product)) variables["gaugeStart"] = isoTime(gaugeHourly ? start - 3_600_000 : start);
  const byPicked = usesPicked(product, picked);
  if (byPicked) variables["picked"] = [...picked];
  const query = productQuery(product, TIME_FIELD[window.period], gaugeHourly ? "datetimeHour" : TIME_FIELD[window.period], byPicked);
  const result = await graphql<Partial<QueryRows>>(query, variables);
  const rows: QueryRows = { sums: result.sums ?? [], stats: result.stats ?? [], gauges: result.gauges ?? [] };
  const full = Object.entries(rows).find(([, list]) => list.length >= ROW_LIMIT);
  if (full === undefined) return rows;
  if (times.length === 1) {
    throw new AnalyticsError(`Cloudflare returned ${ROW_LIMIT} rows of ${full[0]} for one period from ${first}, its most for one query.`);
  }
  return inHalves();
}

/** Ranks resources: the largest first by the metric that matters most for the product. */
function rankOf(product: MetricProduct, resource: MetricResource): number {
  switch (product) {
    case "workers":
      return resource.totals["requests"] ?? 0;
    case "d1":
      return resource.totals["rowsRead"] ?? 0;
    case "r2":
      return resource.latest["storageBytes"] ?? 0;
  }
}

/** The metrics of a product over a range, with series for the picked resources or the five largest. */
export async function productMetrics(
  graphql: GraphqlFn,
  product: MetricProduct,
  range: MetricRange,
  picked: readonly string[],
  now: Date,
): Promise<Omit<MetricsResponse, "names">> {
  const window = metricsWindow(range, now);
  const rows = await queryRows(graphql, product, window, window.times, picked);
  const definition = PRODUCT_METRICS[product];
  const index = new Map(window.times.map((time, position) => [time, position]));
  const count = window.times.length;

  // Sums per resource and period, and their totals over the range.
  const sumsByResource = new Map<string, Record<string, number[]>>();
  for (const row of rows.sums) {
    const position = index.get(rowTime(row.dimensions["t"] ?? ""));
    if (position === undefined) continue;
    const key = row.dimensions["key"] ?? "";
    const series = sumsByResource.get(key) ?? Object.fromEntries(definition.sums.map((metric) => [metric, new Array<number>(count).fill(0)]));
    for (const [metric, value] of Object.entries(sumValues(product, row))) {
      const values = series[metric];
      if (values !== undefined) values[position] = (values[position] ?? 0) + value;
    }
    sumsByResource.set(key, series);
  }

  // Gauges per resource: the largest sample of each period, then the last sample before a period without one.
  const samples = new Map<string, Map<string, Map<string, number>>>();
  for (const row of rows.gauges) {
    const key = row.dimensions["key"] ?? "";
    const time = rowTime(row.dimensions["t"] ?? "");
    const byMetric = samples.get(key) ?? new Map<string, Map<string, number>>();
    for (const [metric, value] of Object.entries(gaugeValues(product, row))) {
      const byTime = byMetric.get(metric) ?? new Map<string, number>();
      byTime.set(time, Math.max(byTime.get(time) ?? 0, value));
      byMetric.set(metric, byTime);
    }
    samples.set(key, byMetric);
  }
  const gaugesByResource = new Map<string, Record<string, (number | null)[]>>();
  for (const [key, byMetric] of samples) {
    const series: Record<string, (number | null)[]> = {};
    for (const metric of definition.gauges) {
      const sorted = [...(byMetric.get(metric) ?? new Map<string, number>()).entries()].sort(([a], [b]) => a.localeCompare(b));
      let cursor = 0;
      let last: number | null = null;
      series[metric] = window.times.map((time) => {
        while (cursor < sorted.length && (sorted[cursor]?.[0] ?? "") <= time) {
          last = sorted[cursor]?.[1] ?? last;
          cursor += 1;
        }
        return last;
      });
    }
    gaugesByResource.set(key, series);
  }

  const resources: MetricResource[] = [...new Set([...sumsByResource.keys(), ...gaugesByResource.keys()])].map((key) => {
    const sums = sumsByResource.get(key);
    const gauges = gaugesByResource.get(key);
    return {
      key,
      totals: Object.fromEntries(definition.sums.map((metric) => [metric, (sums?.[metric] ?? []).reduce((total, value) => total + value, 0)])),
      latest: Object.fromEntries(definition.gauges.map((metric) => [metric, [...(gauges?.[metric] ?? [])].reverse().find((value) => value !== null) ?? null])),
    };
  });
  resources.sort((a, b) => rankOf(product, b) - rankOf(product, a) || a.key.localeCompare(b.key));

  const known = new Set(resources.map((resource) => resource.key));
  const shown =
    picked.length > 0
      ? [...picked].sort((a, b) => resources.findIndex((r) => r.key === a) - resources.findIndex((r) => r.key === b))
      : resources.slice(0, MAX_PICKED_RESOURCES).map((resource) => resource.key);
  const shownSet = new Set(shown);
  const rest = picked.length > 0 ? [] : [...known].filter((key) => !shownSet.has(key));

  const sums: MetricsResponse["sums"] = {};
  for (const metric of definition.sums) {
    const series: Record<string, number[]> = {};
    for (const key of shown) series[key] = sumsByResource.get(key)?.[metric] ?? new Array<number>(count).fill(0);
    if (rest.length > 0) {
      series[OTHER_SERIES] = window.times.map((_, position) =>
        rest.reduce((total, key) => total + (sumsByResource.get(key)?.[metric]?.[position] ?? 0), 0),
      );
    }
    sums[metric] = series;
  }

  const gauges: MetricsResponse["gauges"] = {};
  for (const metric of definition.gauges) {
    const series: Record<string, (number | null)[]> = {};
    for (const key of shown) series[key] = gaugesByResource.get(key)?.[metric] ?? new Array<number | null>(count).fill(null);
    if (rest.length > 0) {
      series[OTHER_SERIES] = window.times.map((_, position) => {
        const values = rest.map((key) => gaugesByResource.get(key)?.[metric]?.[position] ?? null).filter((value) => value !== null);
        return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
      });
    }
    gauges[metric] = series;
  }

  const quantiles: MetricsResponse["quantiles"] = {};
  for (const metric of definition.quantiles) {
    quantiles[metric] = { p50: new Array<number | null>(count).fill(null), p99: new Array<number | null>(count).fill(null) };
  }
  for (const row of rows.stats) {
    const position = index.get(rowTime(row.dimensions["t"] ?? ""));
    if (position === undefined) continue;
    for (const [metric, values] of Object.entries(quantileValues(product, row))) {
      const target = quantiles[metric];
      if (target === undefined) continue;
      target.p50[position] = values.p50;
      target.p99[position] = values.p99;
    }
  }

  return { product, range, period: window.period, times: window.times, resources, shown, sums, quantiles, gauges };
}
