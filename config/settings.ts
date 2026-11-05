// Settings of one polestar deployment.
//
// Each deployment writes its settings in polestar.config.ts. cloudflare.config.ts
// validates them with validateSettings() and turns them into the Worker
// configuration. Every field is required: polestar has no default values, so a
// deployment behaves exactly as its settings say.
//
// Node.js loads this file directly when the Cloudflare CLI reads
// cloudflare.config.ts, so it uses only TypeScript syntax that Node.js can strip.

export type PlanType = "free" | "paid";

export interface BillingSettings {
  /** The Workers plan of the account. It decides the limits and the prices that polestar applies. */
  plan: PlanType;
  /**
   * The day of the month on which the billing cycle of the account starts (1 to 31),
   * as the invoices show it. Monthly included usage resets on this day. In a month
   * without this day, the cycle starts on the last day of the month.
   */
  cycleStartDay: number;
}

export interface HistorySettings {
  /** R2 bucket that keeps the daily usage after Cloudflare analytics stop holding it. */
  bucket: string;
}

export interface AccessSettings {
  /** Cloudflare Access team domain, such as https://example.cloudflareaccess.com. */
  teamDomain: string;
  /** Application Audience (AUD) tag of the Access application that protects the domain. */
  aud: string;
}

export interface PolestarSettings {
  /** Cloudflare account that polestar watches, and that owns its Worker, domain, and bucket. */
  accountId: string;
  /** Name of the Worker. */
  workerName: string;
  /** Hostname that serves polestar. Its zone must be in the same Cloudflare account. */
  domain: string;
  billing: BillingSettings;
  history: HistorySettings;
  access: AccessSettings;
}

/** Declares the settings of a deployment with type checking. */
export function definePolestarConfig(settings: PolestarSettings): PolestarSettings {
  return settings;
}

/** Thrown when polestar.config.ts is incomplete or has invalid values. */
export class SettingsError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      `polestar.config.ts has ${problems.length} problem(s):\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
    this.name = "SettingsError";
    this.problems = problems;
  }
}

const ACCOUNT_ID = /^[0-9a-f]{32}$/;
const WORKER_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
// R2 bucket names: 3 to 63 lowercase letters, digits, and hyphens, starting and ending with a letter or digit.
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const NO_WHITESPACE = /^\S+$/;

type Problems = string[];
type Fields = Record<string, unknown>;

/** Checks the settings and returns them with the team domain normalized to its origin. */
export function validateSettings(input: unknown): PolestarSettings {
  const problems: Problems = [];
  const root = readObject(input, "settings", problems);
  if (root === null) throw new SettingsError(problems);
  checkKeys(root, "", ["accountId", "workerName", "domain", "billing", "history", "access"], problems);

  const accountId = readPattern(root, "accountId", "", ACCOUNT_ID, "a 32-character lowercase hexadecimal account ID", problems);
  const workerName = readPattern(root, "workerName", "", WORKER_NAME, "lowercase letters, digits, and hyphens (at most 63 characters)", problems);
  const domain = readPattern(root, "domain", "", HOSTNAME, "a lowercase hostname without a scheme or path", problems);
  const billing = readBilling(root["billing"], problems);
  const history = readHistory(root["history"], problems);
  const access = readAccess(root["access"], problems);

  if (problems.length > 0 || billing === null || history === null || access === null) {
    throw new SettingsError(problems);
  }
  return { accountId, workerName, domain, billing, history, access };
}

function readBilling(input: unknown, problems: Problems): BillingSettings | null {
  const billing = readObject(input, "billing", problems);
  if (billing === null) return null;
  checkKeys(billing, "billing.", ["plan", "cycleStartDay"], problems);
  const plan = billing["plan"];
  if (!("plan" in billing)) problems.push("billing.plan is missing.");
  else if (plan !== "free" && plan !== "paid") problems.push('billing.plan must be "free" or "paid".');
  const day = billing["cycleStartDay"];
  if (!("cycleStartDay" in billing)) problems.push("billing.cycleStartDay is missing.");
  else if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 31) {
    problems.push("billing.cycleStartDay must be a whole number from 1 to 31.");
  }
  if ((plan !== "free" && plan !== "paid") || typeof day !== "number") return null;
  return { plan, cycleStartDay: day };
}

function readHistory(input: unknown, problems: Problems): HistorySettings | null {
  const history = readObject(input, "history", problems);
  if (history === null) return null;
  checkKeys(history, "history.", ["bucket"], problems);
  const bucket = readPattern(history, "bucket", "history.", BUCKET, "an R2 bucket name of 3 to 63 lowercase letters, digits, and hyphens", problems);
  return { bucket };
}

function readAccess(input: unknown, problems: Problems): AccessSettings | null {
  const access = readObject(input, "access", problems);
  if (access === null) return null;
  checkKeys(access, "access.", ["teamDomain", "aud"], problems);
  const teamDomain = readOrigin(access, "teamDomain", "access.", problems);
  const aud = readPattern(access, "aud", "access.", NO_WHITESPACE, "the AUD tag of the Access application", problems);
  return { teamDomain, aud };
}

function readObject(value: unknown, path: string, problems: Problems): Fields | null {
  if (value === undefined) {
    problems.push(`${path} is missing.`);
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    problems.push(`${path} must be an object.`);
    return null;
  }
  return value as Fields;
}

function readPattern(fields: Fields, key: string, prefix: string, pattern: RegExp, description: string, problems: Problems): string {
  if (!(key in fields)) {
    problems.push(`${prefix}${key} is missing.`);
    return "";
  }
  const value = fields[key];
  if (typeof value !== "string" || !pattern.test(value)) {
    problems.push(`${prefix}${key} must be ${description}.`);
    return "";
  }
  return value;
}

// Accepts an https:// origin, such as the team domain of Cloudflare Access.
function readOrigin(fields: Fields, key: string, prefix: string, problems: Problems): string {
  if (!(key in fields)) {
    problems.push(`${prefix}${key} is missing.`);
    return "";
  }
  const value = fields[key];
  if (typeof value !== "string" || !URL.canParse(value)) {
    problems.push(`${prefix}${key} must be an https:// origin.`);
    return "";
  }
  const url = new URL(value);
  const isOrigin = url.pathname === "/" && url.search === "" && url.hash === "" && url.username === "" && url.password === "";
  if (!isOrigin || url.protocol !== "https:") {
    problems.push(`${prefix}${key} must be an https:// origin.`);
    return "";
  }
  return url.origin;
}

// Reports keys that polestar does not read, which are usually misspelled settings.
function checkKeys(fields: Fields, prefix: string, allowed: readonly string[], problems: Problems): void {
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) problems.push(`${prefix}${key} is not a setting that polestar reads.`);
  }
}
