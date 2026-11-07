// Settings of this polaris deployment.
//
// Copy this file to polaris.config.ts and replace every value. Git ignores
// polaris.config.ts. The account and the API token go in .env instead:
// see .env.example.

import { definePolarisConfig } from "./config/settings.ts";

export default definePolarisConfig({
  workerName: "polaris",
  domain: "usage.example.com",
  billing: {
    // "free" or "paid": the Workers plan of the account
    plan: "free",
    // The day of the month on which the billing cycle starts, as the invoices show it
    cycleStartDay: 1,
  },
  // Cloudflare Access, which lets only these people open polaris
  access: {
    // The team domain of your Zero Trust organization
    teamDomain: "https://example.cloudflareaccess.com",
    // The email addresses that may sign in
    allow: ["you@example.com"],
    // The login methods of your Zero Trust organization that the sign-in page offers,
    // by type, such as "onetimepin", "github", or "passkeys"
    loginMethods: ["onetimepin"],
  },
  // Whether the dashboard charts draw lines at the Free plan limits
  freeLimitLines: true,
});
