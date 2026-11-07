// Bindings that cloudflare.config.ts gives the Worker.

export interface Env {
  AUTH_MODE: string;
  /** Bound only in the "cloudflare-access" mode. */
  ACCESS_TEAM_DOMAIN?: string;
  /** The AUD tag of the Access application, which `pnpm stack:deploy` uploads as a secret. */
  ACCESS_AUD?: string;
  /** The account that polaris watches, from .env. */
  CLOUDFLARE_ACCOUNT_ID: string;
  /** "free" or "paid". */
  BILLING_PLAN: string;
  BILLING_CYCLE_START_DAY: string;
  /** "true" or "false": whether the charts draw the limits of the Free plan. */
  FREE_LIMIT_LINES: string;
  /** A read-only API token of the account, with the permissions that .env.example lists. */
  ANALYTICS_API_TOKEN: string;
}
