// Worker configuration that the Cloudflare CLI (cf) reads.
//
// The values come from polaris.config.ts, so a deployment does not edit this
// file. The account comes from CLOUDFLARE_ACCOUNT_ID in .env, which cf reads.
// `cf dev` runs in the "development" mode: it answers localhost without
// Cloudflare Access. `cf build` and `pnpm stack:deploy`, which runs `cf deploy`,
// use the "production" mode.

import { bindings, defineConfig } from "cf/config";
import polarisConfig from "./polaris.config.ts";
import { validateSettings } from "./config/settings.ts";

export default defineConfig(({ mode }) => {
  const settings = validateSettings(polarisConfig);
  if (mode !== undefined && mode !== "development" && mode !== "production") {
    throw new Error(`polaris runs in the "development" or "production" mode, not "${mode}".`);
  }
  const isDevelopment = mode === "development";

  return {
    worker: {
      name: settings.workerName,
      entrypoint: "./worker/index.ts",
      compatibilityDate: "2026-11-01",
      domains: [settings.domain],
      workersDev: false,
      previewUrls: false,
      observability: { enabled: true },
      // The browser app is static assets. Only /api/* runs the Worker.
      assets: {
        notFoundHandling: "single-page-application",
        runWorkerFirst: ["/api/*"],
      },
      env: {
        // "local-development" lets the Worker answer localhost without an Access token.
        AUTH_MODE: bindings.text(isDevelopment ? "local-development" : "cloudflare-access"),
        ...(isDevelopment
          ? {}
          : {
              ACCESS_TEAM_DOMAIN: bindings.text(settings.access.teamDomain),
              // The AUD tag of the Access application that `pnpm stack:deploy` creates for the domain.
              ACCESS_AUD: bindings.secret(),
            }),
        BILLING_PLAN: bindings.text(settings.billing.plan),
        BILLING_CYCLE_START_DAY: bindings.text(String(settings.billing.cycleStartDay)),
        // From .env: `cf dev` reads them, and `pnpm stack:deploy` uploads them as secrets.
        CLOUDFLARE_ACCOUNT_ID: bindings.secret(),
        ANALYTICS_API_TOKEN: bindings.secret(),
      },
    },
  };
});
