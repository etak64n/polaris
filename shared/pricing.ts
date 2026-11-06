// Published limits and prices of Workers, D1, and R2, in US dollars.
//
// Sources, checked on PRICES_CHECKED_ON:
//   https://developers.cloudflare.com/workers/platform/pricing/
//   https://developers.cloudflare.com/d1/platform/pricing/
//   https://developers.cloudflare.com/r2/pricing/

export const PRICES_CHECKED_ON = "2026-11-05";

/** Bytes in the gigabyte of the storage prices. */
export const GB = 1_000_000_000;

/** Usage that a plan includes each billing cycle, and the price of each million past it. */
export interface CountPrice {
  included: number;
  perMillion: number;
}

/** Storage that a plan includes, as an average over the billing cycle, and the price past it. */
export interface StoragePrice {
  includedGb: number;
  perGbMonth: number;
}

/**
 * Daily limits of the Workers Free plan, for the whole account. Past a limit,
 * requests or queries fail until the limit resets at 00:00 UTC.
 */
export const FREE_DAILY_LIMITS = {
  workerRequests: 100_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
} as const;

/** D1 storage that the Workers Free plan allows, for all databases together. */
export const FREE_D1_STORAGE_BYTES = 5 * GB;

/** The monthly fee of the Workers Paid plan. */
export const PAID_SUBSCRIPTION = 5;

/** Usage-based prices of the Workers Paid plan (the Standard usage model). */
export const PAID_PRICES = {
  workerRequests: { included: 10_000_000, perMillion: 0.3 },
  workerCpuMs: { included: 30_000_000, perMillion: 0.02 },
  d1RowsRead: { included: 25_000_000_000, perMillion: 0.001 },
  d1RowsWritten: { included: 50_000_000, perMillion: 1 },
  d1Storage: { includedGb: 5, perGbMonth: 0.75 },
} satisfies Record<string, CountPrice | StoragePrice>;

/**
 * R2 prices of the Standard storage class. R2 bills the same way on both Workers
 * plans, with a monthly free tier. polaris prices every bucket as Standard storage.
 */
export const R2_PRICES = {
  classA: { included: 1_000_000, perMillion: 4.5 },
  classB: { included: 10_000_000, perMillion: 0.36 },
  storage: { includedGb: 10, perGbMonth: 0.015 },
} satisfies Record<string, CountPrice | StoragePrice>;
