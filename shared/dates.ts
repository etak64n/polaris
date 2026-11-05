// Calendar dates in UTC, written as "YYYY-MM-DD". Cloudflare counts usage by the
// UTC day and resets the daily limits of the Free plan at 00:00 UTC, so polestar
// uses UTC dates everywhere.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isDate(value: string): boolean {
  return DATE.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && utcDate(new Date(`${value}T00:00:00Z`)) === value;
}

/** The UTC date of a moment. */
export function utcDate(time: Date): string {
  return time.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const time = new Date(`${date}T00:00:00Z`);
  time.setUTCDate(time.getUTCDate() + days);
  return utcDate(time);
}

/** Every date from `from` to `to`, both included, oldest first. */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** The month of a date, as YYYY-MM. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** The first moment of a date, as an ISO time. */
export function startOf(date: string): string {
  return `${date}T00:00:00Z`;
}

export interface BillingPeriod {
  /** First date of the billing cycle. */
  start: string;
  /** Last date of the billing cycle. */
  end: string;
  /** Number of dates in the cycle. */
  days: number;
}

/**
 * The billing cycle that contains `date`. A cycle starts on `cycleStartDay` of each
 * month, or on the last day of a month that has no such day, and ends the day
 * before the next cycle starts.
 */
export function billingPeriod(date: string, cycleStartDay: number): BillingPeriod {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const thisMonth = cycleStart(year, month, cycleStartDay);
  const start = date >= thisMonth ? thisMonth : cycleStart(...previousMonth(year, month), cycleStartDay);
  const startYear = Number(start.slice(0, 4));
  const startMonth = Number(start.slice(5, 7));
  const next = cycleStart(...nextMonth(startYear, startMonth), cycleStartDay);
  const end = addDays(next, -1);
  return { start, end, days: datesBetween(start, end).length };
}

function cycleStart(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(day, lastDay))}`;
}

function previousMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

function nextMonth(year: number, month: number): [number, number] {
  return month === 12 ? [year + 1, 1] : [year, month + 1];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
