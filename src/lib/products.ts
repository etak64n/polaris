// The names of the products as Cloudflare writes them, for the sidebar and the titles.

import type { MetricProduct } from "../../shared/metrics.ts";

export const PRODUCT_NAMES: Record<MetricProduct, string> = {
  workers: "Workers",
  durableObjects: "Durable Objects",
  queues: "Queues",
  workflows: "Workflows",
  browserRun: "Browser Run",
  d1: "D1",
  r2: "R2",
  kv: "KV",
  hyperdrive: "Hyperdrive",
  workersAi: "Workers AI",
};
