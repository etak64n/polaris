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

polaris is stateless and requires no database or storage. `pnpm stack:deploy` creates two resources in your Cloudflare account:

| Resource | Role |
| :--- | :--- |
| **Cloudflare Access Application** | Restricts dashboard access to the email addresses you allow. |
| **Cloudflare Worker** | Hosts the dashboard UI and queries Cloudflare APIs on demand using a read-only token. |

## Quickstart

### Prerequisites

| Requirement | Details |
| :--- | :--- |
| **Cloudflare Account & Zero Trust** | A Cloudflare account with a Zero Trust organization, which provides your `https://<team>.cloudflareaccess.com` team domain on the Free plan. |
| **Node.js** | `22.23+`, `24.22+`, or `26.12+` |
| **pnpm** | `12.16+` |

### 1. Create an API Token

Open the [pre-filled Cloudflare Account API Tokens form](https://dash.cloudflare.com/?to=/:account/api-tokens&permissionGroupKeys=%5B%7B%22key%22%3A%22account_analytics%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22d1%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22da1261c3d38544a4bba805b22566f8b6%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%227cf72faf220841aabcfdfab81c43c4f6%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22queues%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22query_cache%22%2C%22type%22%3A%22read%22%7D%5D&name=polaris) and create a read-only token for your account. The form pre-selects the following permissions:

| Permission | Required | Purpose |
| :--- | :--- | :--- |
| `Account Analytics Read` | Yes | Reads account usage and product metrics. |
| `D1 Read` | Yes | Reads D1 database names. |
| `Workers Metadata Read-Only` | Yes | Reads Worker Cron Triggers and Durable Object names. |
| `Billing Read` | Yes | Reads account subscriptions. |
| `Workers KV Storage Read` | Optional | Displays KV namespace names instead of raw IDs. |
| `Queues Read` | Optional | Displays Queue names instead of raw IDs. |
| `Hyperdrive Read` | Optional | Displays Hyperdrive config names instead of raw IDs. |

### 2. Clone and Install

```bash
git clone https://github.com/etak64n/polaris.git
cd polaris
git checkout latest
pnpm install
```

### 3. Configure

Copy the configuration templates:

```bash
cp .env.example .env
cp polaris.config.example.ts polaris.config.ts
```

Set your account ID and API token in `.env`:

```ini
CLOUDFLARE_ACCOUNT_ID=your_account_id
ANALYTICS_API_TOKEN=your_api_token
```

Edit `polaris.config.ts` with your billing plan and Cloudflare Access settings:

```typescript
import { definePolarisConfig } from "./config/settings.ts";

export default definePolarisConfig({
  workerName: "polaris",
  // domain: "usage.example.com", // Optional; defaults to <workerName>.<subdomain>.workers.dev
  billing: {
    plan: "free", // "free" or "paid"
    cycleStartDay: 1,
  },
  access: {
    teamDomain: "https://example.cloudflareaccess.com",
    allow: ["you@example.com"],
    loginMethods: ["onetimepin"],
  },
  freeLimitLines: true,
});
```

### 4. Deploy

```bash
pnpm exec cf auth login
pnpm stack:deploy
```

## Updating and Uninstalling

Check the [release notes](https://github.com/etak64n/polaris/releases) for any configuration changes before updating:

```bash
git fetch --tags --force
git checkout latest
pnpm install
pnpm stack:deploy
```

To remove the Cloudflare Access application and the Worker from your account:

```bash
pnpm stack:delete
```
