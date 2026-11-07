<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/polaris-wordmark-dark.png">
    <img src="images/polaris-wordmark.png" alt="polaris" width="400">
  </picture>
</h1>

<p align="center">polaris is a Cloudflare usage, limit, and cost dashboard built on Cloudflare Workers.</p>

<p align="center">
  <a href="https://github.com/etak64n/polaris/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/etak64n/polaris/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://github.com/etak64n/polaris/actions/workflows/demo.yml"><img alt="Demo" src="https://github.com/etak64n/polaris/actions/workflows/demo.yml/badge.svg" /></a>
  <a href="https://github.com/etak64n/polaris/releases"><img alt="Release" src="https://img.shields.io/github/v/release/etak64n/polaris" /></a>
  <a href="https://github.com/etak64n/polaris/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/etak64n/polaris" /></a>
</p>

<p align="center">
  <a href="https://etak64n.github.io/polaris/">Live Demo</a>
  · <a href="#quickstart">Quickstart</a>
  · <a href="https://github.com/etak64n/polaris/releases">Releases</a>
  · <a href="https://github.com/etak64n/polaris/issues">Issues</a>
</p>

polaris tracks how much of each Cloudflare Free plan limit remains in your account—showing when to upgrade to Workers Paid, or whether a Workers Paid account fits the Free plan again. It also estimates your current billing-cycle cost and charts metrics across Workers, D1, R2, KV, Durable Objects, Queues, Workflows, Hyperdrive, Browser Run, and Workers AI, running as a single database-free Worker in your account behind Cloudflare Access.

## Architecture

![Architecture of polaris](images/architecture.svg)

- **Cloudflare Access**: Authenticates your browser and restricts sign-in to your allowed email addresses and login methods.
- **Cloudflare Workers**: Serves the static dashboard application and verifies the Access token on `/api/*` routes.
- **GraphQL Analytics API**: Provides account usage and product metrics when you open a page.
- **Cloudflare API**: Provides resource names for D1, KV, Durable Objects, Queues, and Hyperdrive using a read-only API token.
- **Cache API**: Caches API responses for a few minutes so reloading a page does not query upstream APIs every time.
- **Resource Tagging**: Tags the Access application and the Worker so they can be deployed and deleted as a single stack.

## Quickstart

### Prerequisites

- **Cloudflare Account**: Manages the DNS zone for your deployment domain.
- **Cloudflare Zero Trust**: Configured in the same account to provide your Cloudflare Access team domain.
- **Node.js**: `^22.23.0 || ^24.22.0 || ^26.12.0`
- **pnpm**: `pnpm@12.16.1`

### 1. Create an API Token

1. **Open the token creation form**: Visit the [Cloudflare Account API Tokens page](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22read%22%7D%5D&name=polaris), which pre-fills the token name `polaris` and the required `Account Analytics Read` and `D1 Read` permissions.
2. **Add optional permissions**: Include `Workers KV Storage Read`, `Workers Scripts Read`, `Queues Read`, and `Hyperdrive Read` to display resource names instead of raw IDs.
3. **Copy the token**: Create the token and save its value for `ANALYTICS_API_TOKEN` in `.env`.

### 2. Configure and Deploy

Install dependencies and copy the configuration templates:

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

Set `CLOUDFLARE_ACCOUNT_ID` and `ANALYTICS_API_TOKEN` in `.env`, then authenticate and deploy:

```bash
pnpm exec cf auth login
pnpm stack:deploy
```

### 3. Update or Delete

- **Update to a new release**: Check the [release notes](https://github.com/etak64n/polaris/releases) for any configuration changes, then check out the tag and redeploy:

```bash
git fetch --tags
git checkout v0.2.0
pnpm install
pnpm stack:deploy
```

- **Delete the deployment**: Remove the Cloudflare Access application and the Worker from your account:

```bash
pnpm stack:delete
```
