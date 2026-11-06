// Bindings that cloudflare.config.ts gives the Worker, and the part of the R2
// API that polaris uses. Declaring this subset here lets the tests run the
// same code against a bucket in memory.

export interface R2ObjectBody {
  text(): Promise<string>;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}

export interface Env {
  HISTORY: R2Bucket;
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
  /** API token with Account Analytics Read and D1 Read on the account. */
  ANALYTICS_API_TOKEN: string;
}
