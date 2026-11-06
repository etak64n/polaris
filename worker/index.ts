// Entry point of the polaris Worker. Cloudflare serves the browser app from
// static assets and runs this Worker for /api/* requests.

import { remoteKeySet } from "./access.ts";
import { CloudflareAnalytics } from "./analytics.ts";
import { createApp } from "./app.ts";
import { edgeCache, noCache, type CacheStore } from "./cache.ts";

const app = createApp({
  keySetFor: remoteKeySet,
  usageSourceFor: (config) => new CloudflareAnalytics(config.accountId, config.apiToken),
  cacheFor: () => {
    // The Workers runtime adds caches.default to the Cache API of the browser.
    const storage = (globalThis as { caches?: { default?: CacheStore } }).caches;
    return storage?.default === undefined ? noCache : edgeCache(storage.default);
  },
  now: () => new Date(),
});

export default { fetch: app.fetch };
