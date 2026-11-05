// Entry point of the polestar Worker. Cloudflare serves the browser app from
// static assets, runs this Worker for /api/* requests, and runs it once a day
// to record the usage in the history bucket.

import { remoteKeySet } from "./access.ts";
import { CloudflareAnalytics } from "./analytics.ts";
import { createApp } from "./app.ts";
import { edgeCache, noCache, type CacheStore } from "./cache.ts";
import type { Env } from "./env.ts";
import { UsageHistory } from "./history.ts";
import { errorFields, log } from "./log.ts";
import { recordHistory } from "./record.ts";
import { readRuntimeConfig } from "./runtime-config.ts";

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

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

async function record(env: Env, scheduledTime: Date): Promise<void> {
  try {
    const config = readRuntimeConfig(env);
    const result = await recordHistory(
      new CloudflareAnalytics(config.accountId, config.apiToken),
      new UsageHistory(env.HISTORY),
      scheduledTime,
    );
    log("INFO", "Recorded the daily usage in the history bucket.", null, { ...result });
  } catch (error) {
    log("ERROR", "Could not record the daily usage.", null, errorFields(error));
    throw error;
  }
}

export default {
  fetch: app.fetch,
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(record(env, new Date(controller.scheduledTime)));
  },
};
