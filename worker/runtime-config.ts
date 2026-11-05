// Reads the Worker bindings into typed configuration. A missing or invalid
// binding stops every request, so the Worker never runs half configured.

import type { PlanType } from "../shared/plan.ts";
import type { Env } from "./env.ts";

export type AuthMode = "cloudflare-access" | "local-development";

export interface AccessConfig {
  teamDomain: string;
  aud: string;
}

export interface RuntimeConfig {
  authMode: AuthMode;
  access: AccessConfig;
  accountId: string;
  apiToken: string;
  plan: PlanType;
  cycleStartDay: number;
}

export class ConfigurationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`The Worker configuration has ${problems.length} problem(s): ${problems.join(" ")}`);
    this.name = "ConfigurationError";
    this.problems = problems;
  }
}

type TextBinding = Exclude<keyof Env, "HISTORY">;

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
  const accountId = text("ACCOUNT_ID");
  if (accountId !== "" && !ACCOUNT_ID.test(accountId)) problems.push("ACCOUNT_ID must be a 32-character account ID.");
  const planText = text("BILLING_PLAN");
  if (planText !== "" && planText !== "free" && planText !== "paid") problems.push('BILLING_PLAN must be "free" or "paid".');
  const dayText = text("BILLING_CYCLE_START_DAY");
  const day = Number(dayText);
  if (dayText !== "" && (!Number.isInteger(day) || day < 1 || day > 31)) {
    problems.push("BILLING_CYCLE_START_DAY must be a whole number from 1 to 31.");
  }

  const config: RuntimeConfig = {
    authMode: authModeText === "local-development" ? "local-development" : "cloudflare-access",
    access: { teamDomain: text("ACCESS_TEAM_DOMAIN"), aud: text("ACCESS_AUD") },
    accountId,
    apiToken: text("ANALYTICS_API_TOKEN"),
    plan: planText === "paid" ? "paid" : "free",
    cycleStartDay: day,
  };
  const history: unknown = env.HISTORY;
  if (history === undefined || history === null) problems.push("HISTORY is not bound to an R2 bucket.");
  if (problems.length > 0) throw new ConfigurationError(problems);
  return config;
}
