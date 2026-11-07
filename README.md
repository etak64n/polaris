<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/polaris-wordmark-dark.png">
    <img src="images/polaris-wordmark.png" alt="polaris" width="400">
  </picture>
</h1>

polaris is a dashboard that tracks how much of each Cloudflare Free plan limit remains in your account.
On the Free plan, it shows when to upgrade to Workers Paid; on Workers Paid, it shows whether your usage fits the Free plan again.
It also estimates your current billing-cycle cost and charts metrics for Workers, D1, R2, KV, Durable Objects, Queues, Workflows, Hyperdrive, Browser Run, and Workers AI.
You deploy polaris as a single Worker in your own account without a database, protected by Cloudflare Access.

Try the [live demo](https://etak64n.github.io/polaris/) to explore every page with sample data.

## Architecture

![Architecture of polaris](images/architecture.svg)

- **Cloudflare Access** authenticates your browser and restricts sign-in to your allowed email addresses and login methods.
- **Cloudflare Workers** serves the static dashboard and verifies the Access token on `/api/*` routes.
- **GraphQL Analytics API** provides account usage and product metrics when you open a page.
- **Cloudflare API** provides resource names for D1, KV, Durable Objects, Queues, and Hyperdrive using a read-only API token.
- **Cache API** caches responses for a few minutes so reloading a page does not query upstream APIs every time.
- **Resource Tagging** tags the Access application and the Worker so `pnpm stack:deploy` and `pnpm stack:delete` can manage them as a single stack.

## Quick start

### Prerequisites

- A Cloudflare account that manages the zone for your deployment domain
- A Cloudflare Zero Trust organization in that account (for your Cloudflare Access team domain)
- Node.js (`^22.23.0 || ^24.22.0 || ^26.12.0`)
- pnpm (`pnpm@12.16.1`)

### 1. Create an API token

polaris uses a read-only account API token (`ANALYTICS_API_TOKEN`) to read metrics and resource names.

1. Open the [Cloudflare Account API Tokens form](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22read%22%7D%5D&name=polaris), which pre-fills the token name `polaris` and the required `Account Analytics Read` and `D1 Read` permissions.
2. (Optional) Add `Workers KV Storage Read`, `Workers Scripts Read`, `Queues Read`, and `Hyperdrive Read` to display resource names instead of raw IDs.
3. Create the token and copy its value for `.env`.

### 2. Configure and deploy

Install dependencies and create your configuration files from the templates:

```bash
pnpm install
cp polaris.config.example.ts polaris.config.ts
cp .env.example .env
```

Edit `polaris.config.ts` with your domain, billing plan, and Cloudflare Access settings:

```typescript
import { definePolarisConfig } from "./config/settings.ts";

export default definePolarisConfig({
  workerName: "polaris",
  domain: "usage.example.com",
  billing: {
    // "free" or "paid": the Workers plan of the account
    plan: "free",
    // The day of the month on which the billing cycle starts, as shown on your invoices
    cycleStartDay: 1,
  },
  // Cloudflare Access settings that control who can open polaris
  access: {
    // The team domain of your Zero Trust organization
    teamDomain: "https://example.cloudflareaccess.com",
    // The email addresses allowed to sign in
    allow: ["you@example.com"],
    // The login methods enabled in your Zero Trust organization,
    // such as "onetimepin", "github", or "passkeys"
    loginMethods: ["onetimepin"],
  },
});
```

Set `CLOUDFLARE_ACCOUNT_ID` and `ANALYTICS_API_TOKEN` in `.env`, then log in to Cloudflare and deploy:

```bash
pnpm exec cf auth login
pnpm stack:deploy
```

### Update or delete

Each version of polaris is published as a [GitHub release](https://github.com/etak64n/polaris/releases) with release notes describing any required configuration changes.

To update to a newer release:

```bash
git fetch --tags
git checkout v0.2.0
pnpm install
pnpm stack:deploy
```

To delete the Access application and the Worker from your Cloudflare account:

```bash
pnpm stack:delete
```
