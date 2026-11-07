<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/polaris-wordmark-dark.png">
    <img src="images/polaris-wordmark.png" alt="polaris" width="400">
  </picture>
</h1>

polaris is a self-hosted dashboard that shows how much of each Cloudflare Free plan limit your account uses today and in the current billing cycle, along with your estimated cost and product metrics.
You deploy polaris as a single Cloudflare Worker in your own account without a database, protected by Cloudflare Access.

Try the [live demo](https://etak64n.github.io/polaris/) to explore every page with sample data.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Create an API token](#create-an-api-token)
  - [Configure and deploy](#configure-and-deploy)
  - [Update or delete](#update-or-delete)
- [License](#license)

## Features

polaris helps you decide when to upgrade from the Free plan to Workers Paid, or whether your Workers Paid usage would fit the Free plan again.

It displays 5 views of your Cloudflare account:

1. Free plan limits
   - Remaining share of each Free plan limit as a gauge (on both Free and Paid plans)
   - Number of Workers requests stopped by a limit
2. Cost estimate
   - Estimated cost for the current billing cycle (spend so far and projected cycle total)
   - Simulated Workers Paid cost when your account is on the Free plan
3. Product dashboards
   - Charts for Workers, Durable Objects, Queues, Workflows, Browser Run, D1, R2, KV, Hyperdrive, and Workers AI
   - Selectable time range from 1 hour to 90 days, with optional auto-reload
4. D1 top queries
   - Queries that read or wrote the most rows in your D1 databases
5. Signed-in user
   - Your email address, login method, sign-in timestamp, and log-out link in the sidebar footer

> Note: polaris calculates estimated cost by applying published Cloudflare pricing to your usage metrics, so estimates can differ slightly from your invoice.

## Architecture

![Architecture of polaris](images/architecture.svg)

polaris runs entirely on 6 Cloudflare services in your account:

1. Cloudflare Access
   - Authenticates your browser before any request reaches the Worker
   - Restricts sign-in to the email addresses and login methods defined in your configuration
2. Cloudflare Workers
   - Serves the static dashboard application
   - Verifies the Cloudflare Access token on `/api/*` routes
3. GraphQL Analytics API
   - Supplies account usage and product metrics when you open a dashboard page
4. Cloudflare API
   - Supplies human-readable resource names for D1, KV, Durable Objects, Queues, and Hyperdrive using your read-only API token
5. Cache API
   - Caches API responses at the edge for a few minutes so reloading a page does not query upstream APIs every time
6. Resource Tagging
   - Tags the Access application and the Worker so `pnpm stack:deploy` and `pnpm stack:delete` can manage them as a single stack

## Quick start

### Prerequisites

You need 4 prerequisites before deploying polaris:

1. A Cloudflare account that manages the zone for your deployment domain
2. A Cloudflare Zero Trust organization in that account (provides your Cloudflare Access team domain)
3. Node.js (`^22.23.0 || ^24.22.0 || ^26.12.0`)
4. pnpm (`pnpm@12.16.1`)

### Create an API token

polaris uses a read-only account API token (`ANALYTICS_API_TOKEN`) to query metrics and resource names.

1. Open the [Cloudflare Account API Tokens form](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22read%22%7D%5D&name=polaris), which pre-fills the token name `polaris` and the 2 required permissions:
   - `Account Analytics Read` (reads usage and metrics from the GraphQL Analytics API)
   - `D1 Read` (reads D1 database names and metrics)
2. To display resource names instead of raw IDs on the KV, Durable Objects, Queues, and Hyperdrive pages, also add these 4 optional permissions:
   - `Workers KV Storage Read`
   - `Workers Scripts Read`
   - `Queues Read`
   - `Hyperdrive Read`
3. Create the token and copy its value for `.env` in the next step.

### Configure and deploy

1. Install dependencies and create your local configuration files from the templates:

```bash
# Install the dependency versions recorded in pnpm-lock.yaml
pnpm install

# Create the deployment settings file from the template
cp polaris.config.example.ts polaris.config.ts

# Create the secrets file from the template
cp .env.example .env
```

2. Edit `polaris.config.ts` with your domain, billing plan, and Cloudflare Access settings:

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

3. Edit `.env` and fill in your Cloudflare account ID and the read-only API token:

```ini
# Run `pnpm exec cf accounts list` if you need to look up your account ID
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
ANALYTICS_API_TOKEN=your_api_token_here
```

4. Authenticate the Cloudflare CLI and deploy the stack:

```bash
# Sign in to your Cloudflare account
pnpm exec cf auth login

# Create or update the Cloudflare Access application and the Worker
pnpm stack:deploy
```

### Update or delete

Each version of polaris is published as a [GitHub release](https://github.com/etak64n/polaris/releases) with release notes describing any required configuration changes.

To update an existing deployment to a newer release:

```bash
# Switch to the target release tag, such as v0.2.0
git fetch --tags
git checkout v0.2.0

# Install that release's dependencies and redeploy the stack
pnpm install
pnpm stack:deploy
```

To remove polaris from your Cloudflare account:

```bash
# Delete the Cloudflare Access application and the Worker after typing the stack name to confirm
pnpm stack:delete
```

## License

polaris is licensed under the MIT License (`LICENSE`).
