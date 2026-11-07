// Settings of one polaris deployment.
//
// Each deployment writes its settings in polaris.config.ts. cloudflare.config.ts
// validates them with validateSettings() and turns them into the Worker
// configuration. Every field is required: polaris has no default values, so a
// deployment behaves exactly as its settings say.
//
// Node.js loads this file directly when the Cloudflare CLI reads
// cloudflare.config.ts, so it uses only TypeScript syntax that Node.js can strip.

export type PlanType = "free" | "paid";

export interface BillingSettings {
  /** The Workers plan of the account. It decides the limits and the prices that polaris applies. */
  plan: PlanType;
  /**
   * The day of the month on which the billing cycle of the account starts (1 to 31),
   * as the invoices show it. Monthly included usage resets on this day. In a month
   * without this day, the cycle starts on the last day of the month.
   */
  cycleStartDay: number;
}

export interface AccessSettings {
  /** Cloudflare Access team domain, such as https://example.cloudflareaccess.com. */
  teamDomain: string;
  /**
   * Email addresses of the people who may open polaris. `pnpm stack:deploy` gives
   * the domain an Access application whose only policy allows these addresses.
   */
  allow: string[];
  /**
   * The login methods of the Zero Trust organization that the sign-in page of the
   * domain offers, each by its type, such as "onetimepin", "github", or "passkeys",
   * or by its ID. The Access application allows these login methods only.
   */
  loginMethods: string[];
}

/**
 * The account is not a setting here: cf and the Worker read it from CLOUDFLARE_ACCOUNT_ID
 * in .env, next to the API token of the same account.
 */
export interface PolarisSettings {
  /** Name of the Worker. */
  workerName: string;
  /** Hostname that serves polaris. Its zone must be in the same Cloudflare account. */
  domain: string;
  billing: BillingSettings;
  access: AccessSettings;
  /** Whether the charts of the dashboards draw a line at the limits of the Free plan. */
  freeLimitLines: boolean;
}

/** Declares the settings of a deployment with type checking. */
export function definePolarisConfig(settings: PolarisSettings): PolarisSettings {
  return settings;
}

/** Thrown when polaris.config.ts is incomplete or has invalid values. */
export class SettingsError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(
      `polaris.config.ts has ${problems.length} problem(s):\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
    this.name = "SettingsError";
    this.problems = problems;
  }
}

const WORKER_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
// A practical check of an email address: one @, no spaces, and a dot in the domain.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_WHITESPACE = /^\S+$/;

type Problems = string[];
type Fields = Record<string, unknown>;

/** Checks the settings and returns them with the team domain normalized to its origin. */
export function validateSettings(input: unknown): PolarisSettings {
  const problems: Problems = [];
  const root = readObject(input, "settings", problems);
  if (root === null) throw new SettingsError(problems);
  checkKeys(root, "", ["workerName", "domain", "billing", "access", "freeLimitLines"], problems);

  const workerName = readPattern(root, "workerName", "", WORKER_NAME, "lowercase letters, digits, and hyphens (at most 63 characters)", problems);
  const domain = readPattern(root, "domain", "", HOSTNAME, "a lowercase hostname without a scheme or path", problems);
  const billing = readBilling(root["billing"], problems);
  const access = readAccess(root["access"], problems);
  const freeLimitLines = readBoolean(root, "freeLimitLines", problems);

  if (problems.length > 0 || billing === null || access === null) {
    throw new SettingsError(problems);
  }
  return { workerName, domain, billing, access, freeLimitLines };
}

function readBoolean(fields: Fields, key: string, problems: Problems): boolean {
  if (!(key in fields)) {
    problems.push(`${key} is missing.`);
    return false;
  }
  if (typeof fields[key] !== "boolean") {
    problems.push(`${key} must be true or false.`);
    return false;
  }
  return fields[key] as boolean;
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

function readAccess(input: unknown, problems: Problems): AccessSettings | null {
  const access = readObject(input, "access", problems);
  if (access === null) return null;
  checkKeys(access, "access.", ["teamDomain", "allow", "loginMethods"], problems);
  const teamDomain = readOrigin(access, "teamDomain", "access.", problems);
  const allow = readEmails(access, "allow", "access.", problems);
  const loginMethods = readLoginMethods(access, problems);
  return { teamDomain, allow, loginMethods };
}

// Reads the login methods of the Access application. `pnpm stack:deploy` looks them up
// in the Zero Trust organization, because only Cloudflare knows which ones exist.
function readLoginMethods(access: Fields, problems: Problems): string[] {
  const path = "access.loginMethods";
  if (!("loginMethods" in access)) {
    problems.push(`${path} is missing.`);
    return [];
  }
  const value = access["loginMethods"];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && NO_WHITESPACE.test(item))) {
    problems.push(`${path} must be a list of login method types or IDs, such as "onetimepin".`);
    return [];
  }
  if (value.length === 0) problems.push(`${path} must name at least one login method.`);
  const repeated = value.filter((item, index) => value.indexOf(item) !== index);
  if (repeated.length > 0) problems.push(`${path} must name each login method once: ${[...new Set(repeated)].join(", ")}.`);
  return value as string[];
}

function readEmails(fields: Fields, key: string, prefix: string, problems: Problems): string[] {
  if (!(key in fields)) {
    problems.push(`${prefix}${key} is missing.`);
    return [];
  }
  const value = fields[key];
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string" && EMAIL.test(item))) {
    problems.push(`${prefix}${key} must be a list of one or more email addresses.`);
    return [];
  }
  return value as string[];
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

// Reports keys that polaris does not read, which are usually misspelled settings.
function checkKeys(fields: Fields, prefix: string, allowed: readonly string[], problems: Problems): void {
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) problems.push(`${prefix}${key} is not a setting that polaris reads.`);
  }
}
