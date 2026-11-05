// Settings of this polestar deployment.
//
// Copy this file to polestar.config.ts and replace every value. Git ignores
// polestar.config.ts. The account and the API token go in .env instead:
// see .env.example.

import { definePolestarConfig } from "./config/settings.ts";

export default definePolestarConfig({
  workerName: "polestar",
  domain: "usage.example.com",
  billing: {
    // "free" or "paid": the Workers plan of the account
    plan: "free",
    // The day of the month on which the billing cycle starts, as the invoices show it
    cycleStartDay: 1,
  },
  // R2 bucket that keeps the daily usage after Cloudflare analytics stop holding it (about 31 days)
  history: {
    bucket: "polestar-history",
  },
  // The Cloudflare Access application that protects the domain
  access: {
    teamDomain: "https://example.cloudflareaccess.com",
    aud: "0000000000000000000000000000000000000000000000000000000000000000",
  },
});
