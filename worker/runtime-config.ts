// Reads the Worker bindings into typed configuration. A missing or invalid
// binding stops every request, so the Worker never runs half configured.

import type { PlanType } from "../shared/plan.ts";
import type { Env } from "./env.ts";

export interface AccessConfig {
  teamDomain: string;
  aud: string;
}

/** Cloudflare Access checks every request, except under `cf dev`, which answers only localhost. */
export type AuthConfig = ({ mode: "cloudflare-access" } & AccessConfig) | { mode: "local-development" };

export interface RuntimeConfig {
  auth: AuthConfig;
  accountId: string;
  apiToken: string;
  plan: PlanType;
  cycleStartDay: number;
  freeLimitLines: boolean;
}

export class ConfigurationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The Worker configuration has ${problems.length} problem(s): ${problems.join(" ")}`);
    this.name = "ConfigurationError";
    this.problems = problems;
  }
}

type TextBinding = keyof Env;

const ACCOUNT_ID = /^[0-9a-f]{32}$/;

export function readRuntimeConfig(env: Env): RuntimeConfig {
  const problems: string[] = [];
  const text = (name: TextBinding): string => {
    const value: unknown = env[name];
    if (typeof value !== "string" || value === "") {
      problems.push(`${name} is not set.`);
      return "";
    }
    return value;
  };

  const authModeText = text("AUTH_MODE");
  if (authModeText !== "" && authModeText !== "cloudflare-access" && authModeText !== "local-development") {
    problems.push('AUTH_MODE must be "cloudflare-access" or "local-development".');
  }
  const accountId = text("CLOUDFLARE_ACCOUNT_ID");
  if (accountId !== "" && !ACCOUNT_ID.test(accountId)) {
    problems.push("CLOUDFLARE_ACCOUNT_ID must be the 32-character ID of an account.");
  }
  const planText = text("BILLING_PLAN");
  if (planText !== "" && planText !== "free" && planText !== "paid") problems.push('BILLING_PLAN must be "free" or "paid".');
  const dayText = text("BILLING_CYCLE_START_DAY");
  const day = Number(dayText);
  if (dayText !== "" && (!Number.isInteger(day) || day < 1 || day > 31)) {
    problems.push("BILLING_CYCLE_START_DAY must be a whole number from 1 to 31.");
  }
  const linesText = text("FREE_LIMIT_LINES");
  if (linesText !== "" && linesText !== "true" && linesText !== "false") problems.push('FREE_LIMIT_LINES must be "true" or "false".');

  const auth: AuthConfig =
    authModeText === "local-development"
      ? { mode: "local-development" }
      : { mode: "cloudflare-access", teamDomain: text("ACCESS_TEAM_DOMAIN"), aud: text("ACCESS_AUD") };
  const config: RuntimeConfig = {
    auth,
    accountId,
    apiToken: text("ANALYTICS_API_TOKEN"),
    plan: planText === "paid" ? "paid" : "free",
    cycleStartDay: day,
    freeLimitLines: linesText === "true",
  };
  if (problems.length > 0) throw new ConfigurationError(problems);
  return config;
}
