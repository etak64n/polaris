// Entry point of the polaris Worker. Cloudflare serves the browser app from
// static assets and runs this Worker for /api/* requests.

import { fetchAccessIdentity, remoteKeySet } from "./access.ts";
import { CloudflareAnalytics } from "./analytics.ts";
import { createApp } from "./app.ts";
import { memoryCache } from "./cache.ts";

const app = createApp({
  keySetFor: remoteKeySet,
  fetchIdentity: fetchAccessIdentity,
  usageSourceFor: (config) => new CloudflareAnalytics(config.accountId, config.apiToken),
  // One cache for the life of the isolate, which the requests that it answers share.
  cache: memoryCache(),
  now: () => new Date(),
});

export default { fetch: app.fetch };
