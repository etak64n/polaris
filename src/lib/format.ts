// Formats numbers, money, sizes, and dates for the screen. Dates are YYYY/MM/DD.

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A count with thousands separators, such as 1,234,567. */
export function formatCount(value: number): string {
  return whole.format(value);
}

/** A short count for axes and tiles, such as 1.2M. */
export function formatCompact(value: number): string {
  return compact.format(value);
}

/** US dollars with cents. An amount above zero but under a cent shows as <$0.01. */
export function formatMoney(value: number): string {
  if (value > 0 && value < 0.005) return "<$0.01";
  return `$${twoDecimals.format(value)}`;
}

/** A size in decimal units, as Cloudflare bills storage: 1 GB is 1,000,000,000 bytes. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : Number(value.toFixed(1))} ${units[unit]}`;
}

const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** CPU time in the largest unit that keeps it above 1: ms, s, min, or h. */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${whole.format(milliseconds)} ms`;
  const seconds = milliseconds / 1000;
  if (seconds < 60) return `${oneDecimal.format(seconds)} s`;
  if (seconds < 3600) return `${oneDecimal.format(seconds / 60)} min`;
  return `${oneDecimal.format(seconds / 3600)} h`;
}

/** A UTC date written as YYYY-MM-DD, shown as YYYY/MM/DD. */
export function formatDate(date: string): string {
  return date.replaceAll("-", "/");
}

/** A share of a whole, such as 42%. */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
