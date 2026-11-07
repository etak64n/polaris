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

polaris tracks how much of each Cloudflare Free plan limit remains in your account. On the Free plan, it shows when to upgrade to Workers Paid; on Workers Paid, it shows whether your usage fits the Free plan again. It also estimates your current billing-cycle cost and charts metrics across Workers, D1, R2, KV, Durable Objects, Queues, Workflows, Hyperdrive, Browser Run, and Workers AI.

## Architecture

![Architecture of polaris](images/architecture.svg)

polaris requires no database or storage of its own. `pnpm stack:deploy` provisions only two resources in your Cloudflare account:

- **Cloudflare Access Application**: Puts a sign-in gate in front of your dashboard domain so only your allowed email addresses can open it.
- **Cloudflare Worker**: Serves the static dashboard UI, verifies the Access token on `/api/*`, fetches metrics on demand from Cloudflare's GraphQL Analytics and REST APIs using a read-only token, and caches responses in the Cache API for a few minutes.

## Quickstart

### Prerequisites

| Requirement | Details |
| :--- | :--- |
| **Custom Domain on Cloudflare** | An active domain in your Cloudflare account so polaris can be hosted on a subdomain such as `usage.example.com`. |
| **Cloudflare Zero Trust** | A Zero Trust organization on the same account, which provides your `https://<team>.cloudflareaccess.com` team domain on the Free plan. |
| **Node.js** | `^22.23.0 \|\| ^24.22.0 \|\| ^26.12.0` |
| **pnpm** | `12.16.1` |

### 1. Create a Read-Only API Token

Open the [Cloudflare Account API Tokens form](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22read%22%7D%5D&name=polaris) and create an account token for `ANALYTICS_API_TOKEN` with the following permissions:

| Scope | Permissions | Purpose |
| :--- | :--- | :--- |
| **Required** | `Account Analytics Read`, `D1 Read` | Reads account usage, product metrics, and D1 database info. |
| **Optional** | `Workers KV Storage Read`, `Workers Scripts Read`, `Queues Read`, `Hyperdrive Read` | Displays human-readable resource names instead of raw IDs for KV, Durable Objects, Queues, and Hyperdrive. |

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

- **Update to the latest release**: Check the [release notes](https://github.com/etak64n/polaris/releases) for any configuration changes, then check out `latest` and redeploy:

```bash
git fetch --tags --force
git checkout latest
pnpm install
pnpm stack:deploy
```

- **Delete the deployment**: Remove the Cloudflare Access application and the Worker from your account:

```bash
pnpm stack:delete
```
