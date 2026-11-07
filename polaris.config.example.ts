// Settings of this polaris deployment.
//
// Copy this file to polaris.config.ts and replace every value. Git ignores
// polaris.config.ts. The account and the API token go in .env instead:
// see .env.example. pnpm stack:deploy applies the settings to the Worker and
// the Access application: run it again after you change one.

import { definePolarisConfig } from "./config/settings.ts";

export default definePolarisConfig({
  workerName: "polaris",
  // Optional custom domain in your Cloudflare account.
  // When omitted, polaris runs on <workerName>.<subdomain>.workers.dev.
  // domain: "usage.example.com",
  billing: {
    // "free" or "paid": the Workers plan of the account
    plan: "free",
    // The day of the month on which the billing cycle starts, as the invoices show it
    cycleStartDay: 1,
  },
  // Cloudflare Access, which asks for a sign-in before polaris opens. pnpm stack:deploy
  // reads the team domain from the Zero Trust organization of the account.
  access: {
    // The email addresses of the people who may open polaris. Access checks them when
    // someone signs in; a person whom you remove keeps a session until it ends, 24 hours.
    allow: ["you@example.com"],
    // The login methods that the sign-in page offers: "all" for every login method of your
    // Zero Trust organization, or a list such as ["onetimepin", "github"].
    // pnpm stack:deploy prints the ones that it allows.
    loginMethods: "all",
  },
  // true draws the limits of the Free plan as lines on the charts; false leaves them out
  freeLimitLines: true,
});
