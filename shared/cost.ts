// Estimates the bill of the current billing cycle from daily usage.
//
// The estimate applies the published prices to the usage that Cloudflare
// analytics report. Analytics sample some datasets, so the estimate can differ
// a little from the invoice.

import { billingPeriod, type BillingPeriod } from "./dates.ts";
import type { PlanType } from "./plan.ts";
import { GB, PAID_PRICES, PAID_SUBSCRIPTION, R2_PRICES, type CountPrice, type StoragePrice } from "./pricing.ts";
import { totalsOf, type DailyUsage, type Metric } from "./usage.ts";

export type Product = "Workers" | "D1" | "R2";

export type Unit = "requests" | "ms" | "rows" | "operations" | "GB-month";

export interface CostLine {
  product: Product;
  item: string;
  unit: Unit;
  /** Usage from the start of the cycle to today. Storage is the average size so far, in GB-month. */
  used: number;
  /** Usage that the cycle includes, or null where the Free plan has a daily limit instead. */
  included: number | null;
  /** Cost of the usage so far, in US dollars. */
  cost: number;
  /** Usage at the end of the cycle if the daily usage stays at its average. Null before the first full day. */
  projectedUsed: number | null;
  projectedCost: number | null;
}

export interface CostEstimate {
  plan: PlanType;
  period: BillingPeriod;
  /** Days of the cycle that have ended. Today is still counting. */
  completeDays: number;
  /** The monthly fee of the plan. */
  subscription: number;
  lines: CostLine[];
  /** The fee plus the cost of the usage so far. */
  total: number;
  /** The fee plus the projected cost of the usage. Null before the first full day of the cycle. */
  projectedTotal: number | null;
}

/** Estimates the cost of the billing cycle that contains `today`. */
export function estimateCost(days: DailyUsage[], plan: PlanType, cycleStartDay: number, today: string): CostEstimate {
  const period = billingPeriod(today, cycleStartDay);
  const cycleDays = days.filter((day) => day.date >= period.start && day.date <= today);
  const complete = cycleDays.filter((day) => day.date < today);
  const usage = new CycleUsage(cycleDays, complete, period);
  const paid = plan === "paid";

  const lines: CostLine[] = [
    usage.count("Workers", "Requests", "requests", "workerRequests", paid ? PAID_PRICES.workerRequests : null),
    usage.count("Workers", "CPU time", "ms", "workerCpuMs", paid ? PAID_PRICES.workerCpuMs : null),
    usage.count("D1", "Rows read", "rows", "d1RowsRead", paid ? PAID_PRICES.d1RowsRead : null),
    usage.count("D1", "Rows written", "rows", "d1RowsWritten", paid ? PAID_PRICES.d1RowsWritten : null),
    usage.storage("D1", "Storage", "d1StorageBytes", paid ? PAID_PRICES.d1Storage : null),
    usage.count("R2", "Class A operations", "operations", "r2ClassA", R2_PRICES.classA),
    usage.count("R2", "Class B operations", "operations", "r2ClassB", R2_PRICES.classB),
    usage.storage("R2", "Storage", "r2StorageBytes", R2_PRICES.storage),
  ];

  const subscription = paid ? PAID_SUBSCRIPTION : 0;
  const total = subscription + sum(lines.map((line) => line.cost));
  const projected = lines.map((line) => line.projectedCost);
  const projectedTotal = projected.every((cost) => cost !== null)
    ? subscription + sum(projected as number[])
    : null;
  return { plan, period, completeDays: complete.length, subscription, lines, total, projectedTotal };
}

class CycleUsage {
  readonly #days: ReturnType<typeof totalsOf>[];
  readonly #complete: ReturnType<typeof totalsOf>[];
  readonly #period: BillingPeriod;

  constructor(days: DailyUsage[], complete: DailyUsage[], period: BillingPeriod) {
    this.#days = days.map(totalsOf);
    this.#complete = complete.map(totalsOf);
    this.#period = period;
  }

  /** A usage that adds up over the cycle, such as requests. Projects the average full day onto the rest of the cycle. */
  count(product: Product, item: string, unit: Unit, metric: Metric, price: CountPrice | null): CostLine {
    const used = sum(this.#days.map((day) => day[metric]));
    let projectedUsed: number | null = null;
    if (this.#complete.length > 0) {
      const completeUsed = sum(this.#complete.map((day) => day[metric]));
      const average = completeUsed / this.#complete.length;
      projectedUsed = Math.max(used, completeUsed + average * (this.#period.days - this.#complete.length));
    }
    const cost = (amount: number): number =>
      price === null ? 0 : (Math.max(0, amount - price.included) / 1_000_000) * price.perMillion;
    return {
      product,
      item,
      unit,
      used,
      included: price?.included ?? null,
      cost: cost(used),
      projectedUsed,
      projectedCost: projectedUsed === null ? null : cost(projectedUsed),
    };
  }

  /**
   * Storage, which Cloudflare bills by the average of the daily peak over the cycle.
   * The cost so far is the share of the cycle that has passed.
   */
  storage(product: Product, item: string, metric: Metric, price: StoragePrice | null): CostLine {
    const averageGb = this.#days.length === 0 ? 0 : sum(this.#days.map((day) => day[metric] / GB)) / this.#days.length;
    const cycleCost = price === null ? 0 : Math.max(0, averageGb - price.includedGb) * price.perGbMonth;
    return {
      product,
      item,
      unit: "GB-month",
      used: averageGb,
      included: price?.includedGb ?? null,
      cost: cycleCost * (this.#days.length / this.#period.days),
      projectedUsed: averageGb,
      projectedCost: cycleCost,
    };
  }
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
