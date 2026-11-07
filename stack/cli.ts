// `pnpm stack:deploy` and `pnpm stack:delete`: create, update, or delete every
// resource of this polaris deployment. Sign in with `cf auth login` first. The
// settings come from polaris.config.ts and the account from .env.
//
//   pnpm stack:deploy
//   pnpm stack:delete [--confirm <stack name>]

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateSettings, type PolarisSettings } from "../config/settings.ts";
import { projectCf } from "./cf.ts";
import { parseEnvFile } from "./env-file.ts";
import { deleteStack, deployStack, describe, stackResources, STACK_TAG, type SecretsFile } from "./stack.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ACCOUNT_ID = /^[0-9a-f]{32}$/;

const USAGE = "Usage: pnpm stack:deploy | pnpm stack:delete [--confirm <stack name>]";

async function main(args: string[]): Promise<void> {
  const [command, ...options] = args;
  if (command !== "deploy" && command !== "delete") throw new Error(USAGE);
  const settings = await readSettings();
  const env = readEnv();
  const cf = projectCf(ROOT);
  const log = (line: string) => console.log(line);

  if (command === "deploy") {
    if (options.length > 0) throw new Error(USAGE);
    const accountId = accountIdOf(env);
    const analyticsApiToken = env.get("ANALYTICS_API_TOKEN") ?? "";
    if (analyticsApiToken === "") throw new Error("ANALYTICS_API_TOKEN in .env is empty. .env.example tells how to create the token.");
    console.log(`Deploying the stack ${settings.workerName}.`);
    deployStack({ settings, secrets: { accountId, analyticsApiToken }, cf, log, writeSecretsFile });
    return;
  }

  const confirmation = readConfirmOption(options);
  accountIdOf(env);
  const { resources, others } = stackResources(cf, settings.workerName);
  if (resources.length === 0) {
    console.log(`No resource carries the tag ${STACK_TAG}=${settings.workerName}.`);
  } else {
    console.log(`The stack ${settings.workerName} has these resources:`);
    for (const resource of resources) console.log(`  ${describe(resource)}`);
    if (!(await confirmed(settings.workerName, confirmation))) {
      console.log("Nothing was deleted.");
      return;
    }
    deleteStack({ cf, log, resources });
  }
  // What the stack does not own, which stays in the account.
  console.log("\nDelete these yourself if you no longer need them:");
  console.log("  The API token in ANALYTICS_API_TOKEN of .env, on the Account API Tokens page of the account");
  for (const other of others) console.log(`  ${other}, which carries the tag of the stack but is not a resource that polaris creates`);
}

async function readSettings(): Promise<PolarisSettings> {
  const file = join(ROOT, "polaris.config.ts");
  if (!existsSync(file)) throw new Error("polaris.config.ts does not exist. Copy polaris.config.example.ts to it and fill in the values.");
  const module = (await import(pathToFileURL(file).href)) as { default: unknown };
  return validateSettings(module.default);
}

function readEnv(): Map<string, string> {
  const file = join(ROOT, ".env");
  if (!existsSync(file)) throw new Error(".env does not exist. Copy .env.example to it and fill in the values.");
  return parseEnvFile(readFileSync(file, "utf8"));
}

function accountIdOf(env: Map<string, string>): string {
  const accountId = env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  if (!ACCOUNT_ID.test(accountId)) throw new Error("CLOUDFLARE_ACCOUNT_ID in .env must be the 32-character ID of an account. `cf accounts list` shows the IDs.");
  return accountId;
}

function readConfirmOption(options: string[]): string | null {
  if (options.length === 0) return null;
  const [flag, value] = options;
  if (flag !== "--confirm" || value === undefined || options.length !== 2) throw new Error(USAGE);
  return value;
}

/** The person types the stack name, or passes it with --confirm where nobody can type. */
async function confirmed(stack: string, confirmation: string | null): Promise<boolean> {
  if (confirmation !== null) return confirmation === stack;
  if (!process.stdin.isTTY) throw new Error(`Pass --confirm ${stack} to delete the stack without a prompt.`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await prompt.question(`\nType ${stack} to delete all of them: `)).trim() === stack;
  } finally {
    prompt.close();
  }
}

/** The secrets for cf deploy, in a folder that only this user can read, which is removed after the deploy. */
function writeSecretsFile(values: Record<string, string>): SecretsFile {
  const folder = mkdtempSync(join(tmpdir(), "polaris-"));
  const path = join(folder, "secrets.json");
  writeFileSync(path, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
  return { path, remove: () => rmSync(folder, { recursive: true, force: true }) };
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? `\n${error.message}` : error);
  process.exitCode = 1;
}
