import { defineConfig } from "vitest/config";

// Tests run in Node.js. They answer the Cloudflare APIs with recorded responses
// and keep the history bucket in memory, so they need no Cloudflare account.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
