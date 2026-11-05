// Reads the usage of the account from the Cloudflare GraphQL Analytics API, and
// the names of the D1 databases from the Cloudflare API.
//
// The token needs Account Analytics Read for the usage and D1 Read for the names.

import type { QueryOrder, TopQuery } from "../shared/api.ts";
import { addDays, datesBetween, startOf } from "../shared/dates.ts";
import { emptyDay, type D1Usage, type DailyUsage, type R2Usage, type WorkerUsage } from "../shared/usage.ts";

const API = "https://api.cloudflare.com/client/v4";

/** The most rows that one dataset returns. polestar refuses to show a range that reaches it, rather than show part of it. */
export const ROW_LIMIT = 10_000;

/** The longest range that one usage query covers. Analytics keep about 31 days of D1 and R2 usage. */
export const MAX_QUERY_DAYS = 31;

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

/** Thrown when Cloudflare does not return the usage, with the reason that it gave. */
export class AnalyticsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsError";
  }
}

export interface UsageSource {
  /** The usage of each date from `from` to `to`, both included, oldest first. */
  dailyUsage(from: string, to: string): Promise<DailyUsage[]>;
  /** The D1 queries that read or wrote the most rows from `from` to `to`, both included. */
  topQueries(from: string, to: string, order: QueryOrder, limit: number): Promise<TopQuery[]>;
  /** D1 database names by database ID. */
  databaseNames(): Promise<Record<string, string>>;
}

// R2 operations by price class: https://developers.cloudflare.com/r2/pricing/
const CLASS_B = new Set([
  "HeadBucket",
  "HeadObject",
  "GetObject",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);
const FREE_OPERATIONS = new Set(["DeleteObject", "DeleteBucket", "AbortMultipartUpload"]);

/**
 * The price class of an R2 operation. Operations that the price list does not
 * name count as Class A, the more expensive class, so that the estimate does
 * not fall short of the bill.
 */
export function r2Class(actionType: string): "A" | "B" | "free" {
  if (CLASS_B.has(actionType)) return "B";
  if (FREE_OPERATIONS.has(actionType)) return "free";
  return "A";
}

const USAGE_QUERY = `
query PolestarUsage($accountTag: string!, $from: Date!, $to: Date!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workers: workersInvocationsAdaptive(limit: ${ROW_LIMIT}, filter: { datetime_geq: $start, datetime_lt: $end }) {
        sum { requests cpuTimeUs }
        dimensions { date scriptName }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { date_geq: $from, date_leq: $to }) {
        sum { rowsRead rowsWritten }
        dimensions { date databaseId }
      }
      d1Storage: d1StorageAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { date_geq: $from, date_leq: $to }) {
        max { databaseSizeBytes }
        dimensions { date databaseId }
      }
      r2Operations: r2OperationsAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { datetime_geq: $start, datetime_lt: $end }) {
        sum { requests }
        dimensions { date bucketName actionType }
      }
      r2Storage: r2StorageAdaptiveGroups(limit: ${ROW_LIMIT}, filter: { datetime_geq: $start, datetime_lt: $end }) {
        max { payloadSize metadataSize }
        dimensions { date bucketName }
      }
    }
  }
}`;

const TOP_QUERIES_QUERY = (order: QueryOrder, limit: number): string => `
query PolestarTopQueries($accountTag: string!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      queries: d1QueriesAdaptiveGroups(limit: ${limit}, filter: { datetimeHour_geq: $start, datetimeHour_lt: $end }, orderBy: [sum_${order}_DESC]) {
        count
        sum { rowsRead rowsWritten queryDurationMs }
        dimensions { query databaseId }
      }
    }
  }
}`;

export interface WorkerRow {
  sum: { requests: number; cpuTimeUs: number };
  dimensions: { date: string; scriptName: string };
}
export interface D1Row {
  sum: { rowsRead: number; rowsWritten: number };
  dimensions: { date: string; databaseId: string };
}
export interface D1StorageRow {
  max: { databaseSizeBytes: number };
  dimensions: { date: string; databaseId: string };
}
export interface R2OperationRow {
  sum: { requests: number };
  dimensions: { date: string; bucketName: string; actionType: string };
}
export interface R2StorageRow {
  max: { payloadSize: number; metadataSize: number };
  dimensions: { date: string; bucketName: string };
}
export interface UsageAccount {
  workers: WorkerRow[];
  d1: D1Row[];
  d1Storage: D1StorageRow[];
  r2Operations: R2OperationRow[];
  r2Storage: R2StorageRow[];
}
interface TopQueryRow {
  count: number;
  sum: { rowsRead: number; rowsWritten: number; queryDurationMs: number };
  dimensions: { query: string; databaseId: string };
}

export class CloudflareAnalytics implements UsageSource {
  readonly #accountId: string;
  readonly #token: string;
  readonly #fetch: FetchFn;

  constructor(accountId: string, token: string, fetchFn: FetchFn = (input, init) => fetch(input, init)) {
    this.#accountId = accountId;
    this.#token = token;
    this.#fetch = fetchFn;
  }

  async dailyUsage(from: string, to: string): Promise<DailyUsage[]> {
    const dates = datesBetween(from, to);
    if (dates.length === 0 || dates.length > MAX_QUERY_DAYS) {
      throw new RangeError(`A usage query covers 1 to ${MAX_QUERY_DAYS} days, not ${from} to ${to}.`);
    }
    const account = await this.#graphql<UsageAccount>(USAGE_QUERY, {
      from,
      to,
      start: startOf(from),
      end: startOf(addDays(to, 1)),
    });
    for (const [name, rows] of Object.entries(account)) {
      if (rows.length >= ROW_LIMIT) {
        throw new AnalyticsError(
          `Cloudflare returned ${ROW_LIMIT} rows of ${name} for ${from} to ${to}, its most for one query, so the usage may be incomplete.`,
        );
      }
    }
    return buildDays(dates, account);
  }

  async topQueries(from: string, to: string, order: QueryOrder, limit: number): Promise<TopQuery[]> {
    const account = await this.#graphql<{ queries: TopQueryRow[] }>(TOP_QUERIES_QUERY(order, limit), {
      start: startOf(from),
      end: startOf(addDays(to, 1)),
    });
    return account.queries
      .filter((row) => row.dimensions.query !== "")
      .map((row) => ({
        databaseId: row.dimensions.databaseId,
        query: row.dimensions.query,
        runs: row.count,
        rowsRead: row.sum.rowsRead,
        rowsWritten: row.sum.rowsWritten,
        durationMs: row.sum.queryDurationMs,
      }));
  }

  async databaseNames(): Promise<Record<string, string>> {
    const names: Record<string, string> = {};
    const perPage = 100;
    for (let page = 1; ; page += 1) {
      const url = `${API}/accounts/${this.#accountId}/d1/database?page=${page}&per_page=${perPage}`;
      const body = await this.#request(url, { method: "GET" });
      const result = (body as { result?: unknown }).result;
      if (!Array.isArray(result)) throw new AnalyticsError("The Cloudflare API returned no list of D1 databases.");
      for (const database of result as { uuid?: unknown; name?: unknown }[]) {
        if (typeof database.uuid === "string" && typeof database.name === "string") names[database.uuid] = database.name;
      }
      if (result.length < perPage) return names;
    }
  }

  async #graphql<T>(query: string, variables: Record<string, string>): Promise<T> {
    const body = await this.#request(`${API}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { accountTag: this.#accountId, ...variables } }),
    });
    const { data, errors } = body as {
      data?: { viewer?: { accounts?: T[] } } | null;
      errors?: { message?: string }[] | null;
    };
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors.map((error) => error.message ?? "unknown error").join(" ");
      throw new AnalyticsError(`The Cloudflare GraphQL API returned errors: ${messages}`);
    }
    const account = data?.viewer?.accounts?.[0];
    if (account === undefined) {
      throw new AnalyticsError("The Cloudflare GraphQL API returned no data for the account. Check CLOUDFLARE_ACCOUNT_ID and the token.");
    }
    return account;
  }

  async #request(url: string, init: RequestInit): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.#token}`);
    let response: Response;
    try {
      response = await this.#fetch(url, { ...init, headers });
    } catch (error) {
      throw new AnalyticsError(`Could not reach the Cloudflare API: ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await response.text();
    if (!response.ok) {
      throw new AnalyticsError(`The Cloudflare API answered ${response.status}: ${text.slice(0, 300)}`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AnalyticsError("The Cloudflare API answered with something other than JSON.");
    }
  }
}

/** Turns the rows of each dataset into one record per date and resource. */
export function buildDays(dates: string[], account: UsageAccount): DailyUsage[] {
  const days = new Map(dates.map((date) => [date, emptyDay(date)]));
  const workers = new Map<string, WorkerUsage>();
  const databases = new Map<string, D1Usage>();
  const buckets = new Map<string, R2Usage>();

  const worker = (date: string, scriptName: string): WorkerUsage | undefined => {
    const day = days.get(date);
    if (day === undefined) return undefined;
    const key = `${date}/${scriptName}`;
    let usage = workers.get(key);
    if (usage === undefined) {
      usage = { scriptName, requests: 0, cpuTimeMs: 0 };
      workers.set(key, usage);
      day.workers.push(usage);
    }
    return usage;
  };
  const database = (date: string, databaseId: string): D1Usage | undefined => {
    const day = days.get(date);
    if (day === undefined) return undefined;
    const key = `${date}/${databaseId}`;
    let usage = databases.get(key);
    if (usage === undefined) {
      usage = { databaseId, rowsRead: 0, rowsWritten: 0, storageBytes: 0 };
      databases.set(key, usage);
      day.d1.push(usage);
    }
    return usage;
  };
  const bucket = (date: string, bucketName: string): R2Usage | undefined => {
    const day = days.get(date);
    if (day === undefined) return undefined;
    const key = `${date}/${bucketName}`;
    let usage = buckets.get(key);
    if (usage === undefined) {
      usage = { bucketName, classA: 0, classB: 0, storageBytes: 0 };
      buckets.set(key, usage);
      day.r2.push(usage);
    }
    return usage;
  };

  for (const row of account.workers) {
    const usage = worker(row.dimensions.date, row.dimensions.scriptName);
    if (usage === undefined) continue;
    usage.requests += row.sum.requests;
    usage.cpuTimeMs += row.sum.cpuTimeUs / 1000;
  }
  for (const row of account.d1) {
    const usage = database(row.dimensions.date, row.dimensions.databaseId);
    if (usage === undefined) continue;
    usage.rowsRead += row.sum.rowsRead;
    usage.rowsWritten += row.sum.rowsWritten;
  }
  for (const row of account.d1Storage) {
    const usage = database(row.dimensions.date, row.dimensions.databaseId);
    if (usage === undefined) continue;
    usage.storageBytes = Math.max(usage.storageBytes, row.max.databaseSizeBytes);
  }
  for (const row of account.r2Operations) {
    const priceClass = r2Class(row.dimensions.actionType);
    if (priceClass === "free") continue;
    const usage = bucket(row.dimensions.date, row.dimensions.bucketName);
    if (usage === undefined) continue;
    if (priceClass === "A") usage.classA += row.sum.requests;
    else usage.classB += row.sum.requests;
  }
  for (const row of account.r2Storage) {
    const usage = bucket(row.dimensions.date, row.dimensions.bucketName);
    if (usage === undefined) continue;
    usage.storageBytes = Math.max(usage.storageBytes, row.max.payloadSize + row.max.metadataSize);
  }

  const byName = <T>(name: (item: T) => string) => (a: T, b: T): number => name(a).localeCompare(name(b));
  return dates.map((date) => {
    const day = days.get(date) as DailyUsage;
    day.workers.sort(byName((item) => item.scriptName));
    day.d1.sort(byName((item) => item.databaseId));
    day.r2.sort(byName((item) => item.bucketName));
    return day;
  });
}
