// A stand-in for Cloudflare analytics.

import type { QueryOrder, TopQuery } from "../../shared/api.ts";
import type { MetricProduct, MetricRange, MetricsResponse } from "../../shared/metrics.ts";
import { datesBetween } from "../../shared/dates.ts";
import { emptyDay, type DailyUsage } from "../../shared/usage.ts";
import type { UsageSource } from "../../worker/analytics.ts";

/** Usage of one Worker, one database, and one bucket, with the same numbers for every resource. */
export function usageOf(date: string, amount: number): DailyUsage {
  return {
    date,
    workers: [{ scriptName: "api", requests: amount, cpuTimeMs: amount / 10 }],
    d1: [{ databaseId: "db-1", rowsRead: amount * 10, rowsWritten: amount, storageBytes: 1_000_000 }],
    r2: [{ bucketName: "files", classA: amount, classB: amount * 2, storageBytes: 2_000_000 }],
    workersStopped: 0,
    kv: { reads: amount * 3, writes: amount, deletes: 0, lists: 0 },
  };
}

export class FakeUsageSource implements UsageSource {
  readonly usageCalls: { from: string; to: string }[] = [];
  readonly queryCalls: { from: string; to: string; order: QueryOrder; limit: number; databaseIds: readonly string[] }[] = [];
  readonly metricCalls: { product: MetricProduct; range: MetricRange; picked: readonly string[]; now: Date }[] = [];
  usage: (date: string) => DailyUsage = (date) => emptyDay(date);
  queries: TopQuery[] = [];
  names: Record<string, string> = {};
  failure: Error | null = null;

  async dailyUsage(from: string, to: string): Promise<DailyUsage[]> {
    this.usageCalls.push({ from, to });
    if (this.failure !== null) throw this.failure;
    return datesBetween(from, to).map((date) => this.usage(date));
  }

  async topQueries(from: string, to: string, order: QueryOrder, limit: number, databaseIds: readonly string[]): Promise<TopQuery[]> {
    this.queryCalls.push({ from, to, order, limit, databaseIds });
    if (this.failure !== null) throw this.failure;
    return this.queries;
  }

  async metrics(product: MetricProduct, range: MetricRange, picked: readonly string[], now: Date): Promise<Omit<MetricsResponse, "names">> {
    this.metricCalls.push({ product, range, picked, now });
    if (this.failure !== null) throw this.failure;
    return { product, range, period: "5m", times: [], resources: [], shown: [...picked], sums: {}, quantiles: {}, gauges: {} };
  }

  async databaseNames(): Promise<Record<string, string>> {
    if (this.failure !== null) throw this.failure;
    return this.names;
  }
}
