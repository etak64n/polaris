// The form of the Cloudflare dashboard that creates the API token of polaris: a new
// account API token of the account in .env, with the read permissions of polaris selected.
// The link names the account, so the dashboard opens the form without asking which
// account, and the token never lands in another account of the same person.

/**
 * The permissions that the form selects, by the keys of the dashboard or by the IDs of
 * permission groups that have no key.
 */
export const TOKEN_PERMISSIONS = [
  // Required: the usage, the names of the D1 databases, the Cron Triggers and the names
  // of the Durable Objects (Workers Metadata Read-Only), and the subscriptions (Billing Read).
  { key: "account_analytics", type: "read" },
  { key: "d1", type: "read" },
  { key: "da1261c3d38544a4bba805b22566f8b6", type: "read" },
  { key: "7cf72faf220841aabcfdfab81c43c4f6", type: "read" },
  // Optional: the names of the KV namespaces, the queues, and the Hyperdrive configurations.
  { key: "workers_kv_storage", type: "read" },
  { key: "queues", type: "read" },
  { key: "query_cache", type: "read" },
] as const;

/** The link to the form for the API token of polaris in an account. */
export function tokenFormUrl(accountId: string): string {
  const permissions = encodeURIComponent(JSON.stringify(TOKEN_PERMISSIONS));
  return `https://dash.cloudflare.com/${accountId}/api-tokens/create?permissionGroupKeys=${permissions}&name=polaris`;
}
