// A polaris deployment as one stack, as in CloudFormation: `pnpm stack:deploy`
// creates or updates every resource that the settings describe, and
// `pnpm stack:delete` deletes them all.
//
// Cloudflare keeps the list of the resources of a stack. Each one carries the tag
// polaris.stack=<Worker name> (Resource Tagging), so this machine keeps no state.
// A resource that already carries the tag of another stack is never taken over.

import type { PolarisSettings } from "../config/settings.ts";
import { CF_ATTEMPTS, CF_FIRST_DELAY_MS, CfError, isPassingCfError, type Cf } from "./cf.ts";

/** The tag that marks the resources of a stack. Its value is the name of the stack, the Worker name. */
export const STACK_TAG = "polaris.stack";

export type ResourceType = "worker" | "access_application";

export interface StackResource {
  type: ResourceType;
  /** The ID that Resource Tagging uses: the Worker ID or the Access application ID. */
  id: string;
  /** What people know the resource by: the Worker name or the name of the Access application. */
  name: string;
}

/** Secrets of the Worker, from .env. */
export interface StackSecrets {
  accountId: string;
  analyticsApiToken: string;
}

export interface SecretsFile {
  path: string;
  remove(): void;
}

export interface DeployOptions {
  settings: PolarisSettings;
  secrets: StackSecrets;
  cf: Cf;
  log: (line: string) => void;
  /** Writes the secrets that cf deploy uploads to a file that only this user can read. */
  writeSecretsFile: (values: Record<string, string>) => SecretsFile;
}

/** Creates or updates the resources of the stack, deploys the Worker, and returns the resources. */
export function deployStack({ settings, secrets, cf, log, writeSecretsFile }: DeployOptions): StackResource[] {
  const stack = settings.workerName;

  // Find what exists, and stop before any change if part of it belongs to another stack.
  let existingWorker = findWorker(cf, stack);
  const hadWorker = existingWorker !== null;
  let domain = settings.domain ?? existingWorker?.hostname ?? workersDevDomainFromList(cf, stack);
  let existingApp = domain === undefined ? null : (accessApplications(cf).find((app) => app.domain === domain) ?? null);
  const tagsOf = new Map<string, Record<string, string>>();
  const claim = (resource: StackResource) => {
    const tags = readOwnTags(cf, resource);
    const owner = tags[STACK_TAG];
    if (owner !== undefined && owner !== stack) {
      throw new Error(`${describe(resource)} belongs to the stack ${owner}, so the stack ${stack} cannot use it.`);
    }
    tagsOf.set(key(resource), tags);
  };
  if (existingApp !== null) claim({ type: "access_application", id: existingApp.id, name: settings.workerName });
  if (existingWorker !== null) claim({ type: "worker", id: existingWorker.id, name: stack });
  // The Zero Trust organization signs the tokens of Access. An account without one stops
  // the deploy here too.
  const teamDomain = accessTeamDomain(cf);

  if (domain === undefined) {
    // When the account has no Workers yet, deploy once so Cloudflare assigns the workers.dev URL.
    deployWorker(cf, writeSecretsFile, secrets, { teamDomain, aud: "pending" });
    existingWorker = findWorker(cf, stack);
    domain = existingWorker?.hostname;
    if (domain === undefined) {
      throw new Error(`Cloudflare did not return a workers.dev URL for the Worker ${stack}. Set domain in polaris.config.ts.`);
    }
    existingApp = accessApplications(cf).find((app) => app.domain === domain) ?? null;
    if (existingApp !== null) claim({ type: "access_application", id: existingApp.id, name: settings.workerName });
  }

  const resources: StackResource[] = [];
  const mark = (resource: StackResource) => {
    writeTags(cf, resource, { ...(tagsOf.get(key(resource)) ?? {}), [STACK_TAG]: stack });
    resources.push(resource);
  };

  // The Access application of the domain, whose only policy allows the people in the
  // settings, and whose sign-in page offers the login methods of the organization.
  const body = JSON.stringify(accessApplicationBody({ ...settings, domain }));
  const app = readAccessApplication(
    existingApp === null
      ? createOnce(cf, ["zero-trust", "access", "applications", "create", "--body", body], () =>
          list(cf.json(["zero-trust", "access", "applications", "list"])).find((item) => text(item, "domain") === domain),
        )
      : cf.json(["zero-trust", "access", "applications", "update", existingApp.id, "--body", body]),
  );
  const appResource: StackResource = { type: "access_application", id: app.id, name: settings.workerName };
  mark(appResource);
  log(`${describe(appResource)}: ${existingApp === null ? "created" : "updated"}`);

  // The Worker, with the secrets of .env, the team domain, and the AUD tag of the Access application.
  deployWorker(cf, writeSecretsFile, secrets, { teamDomain, aud: app.aud });
  const worker = findWorker(cf, stack);
  if (worker === null) throw new Error(`cf deploy finished, but the Worker ${stack} does not exist.`);
  const workerResource: StackResource = { type: "worker", id: worker.id, name: stack };
  mark(workerResource);
  log(`${describe(workerResource)}: ${hadWorker ? "updated" : "created"}`);
  log(`\npolaris runs at https://${domain}/`);
  return resources;
}

/** The resources that carry the tag of the stack, in the order in which they can be deleted. */
export function stackResources(cf: Cf, stack: string): { resources: StackResource[]; others: string[] } {
  const raw = cf.json(["tags", "resources", "list", "--tag", `${STACK_TAG}=${stack}`]);
  const resources: StackResource[] = [];
  const others: string[] = [];
  for (const item of list(raw)) {
    const type = text(item, "type") ?? text(item, "resource_type");
    const id = text(item, "id") ?? text(item, "resource_id");
    if (type === undefined || id === undefined) continue;
    const name = text(item, "name") ?? id;
    if (type === "worker" || type === "access_application") resources.push({ type, id, name });
    else others.push(`${type} ${name}`);
  }
  // Stop serving first, then remove who may sign in.
  const order: ResourceType[] = ["worker", "access_application"];
  resources.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return { resources, others };
}

export interface DeleteOptions {
  cf: Cf;
  log: (line: string) => void;
  resources: StackResource[];
}

/**
 * Deletes the resources of a stack, which the person has confirmed, so cf asks
 * nothing more (--force).
 *
 * Cloudflare keeps the tags of a resource after the resource is gone, so each tag
 * is removed too. A resource that is already gone counts as deleted, so a delete
 * that stopped halfway can run again.
 */
export function deleteStack({ cf, log, resources }: DeleteOptions): void {
  for (const resource of resources) {
    const existed = unlessGone(() => {
      switch (resource.type) {
        case "worker":
          cf.json(["workers", "delete", resource.id, "--force"]);
          break;
        case "access_application":
          cf.json(["zero-trust", "access", "applications", "delete", resource.id, "--force"]);
          break;
      }
    });
    cf.json(["tags", "account-resources", "delete", "--resource-type", resource.type, "--resource-id", resource.id, "--force"]);
    log(`${describe(resource)}: ${existed ? "deleted" : "already gone"}`);
  }
}

/** Runs a deletion, and answers false when the resource did not exist. */
function unlessGone(remove: () => void): boolean {
  try {
    remove();
    return true;
  } catch (error) {
    if (error instanceof CfError && error.status === 404) return false;
    throw error;
  }
}

export function describe(resource: StackResource): string {
  switch (resource.type) {
    case "worker":
      return `Worker ${resource.name}`;
    case "access_application":
      return `Access application ${resource.name}`;
  }
}

/**
 * The Access application that lets only the people in the settings open the domain.
 * Without a list of identity providers, its sign-in page offers every login method of
 * the Zero Trust organization. Cloudflare replaces the whole application on an update,
 * so the body holds every setting that polaris makes.
 */
export function accessApplicationBody(settings: PolarisSettings & { domain: string }) {
  return {
    name: settings.workerName,
    domain: settings.domain,
    type: "self_hosted",
    policies: [
      {
        name: "Allowed people",
        decision: "allow",
        include: settings.access.allow.map((email) => ({ email: { email } })),
      },
    ],
  };
}

function deployWorker(
  cf: Cf,
  writeSecretsFile: (values: Record<string, string>) => SecretsFile,
  secrets: StackSecrets,
  access: { teamDomain: string; aud: string },
): void {
  const file = writeSecretsFile({
    CLOUDFLARE_ACCOUNT_ID: secrets.accountId,
    ANALYTICS_API_TOKEN: secrets.analyticsApiToken,
    ACCESS_TEAM_DOMAIN: access.teamDomain,
    ACCESS_AUD: access.aud,
  });
  try {
    cf.run(["deploy", "--secrets-file", file.path]);
  } finally {
    file.remove();
  }
}

/** The team domain of the Zero Trust organization of the account, which signs the tokens of Access. */
function accessTeamDomain(cf: Cf): string {
  let organization: unknown = null;
  try {
    organization = cf.json(["zero-trust", "organization", "get"]);
  } catch (error) {
    if (!(error instanceof CfError && error.status === 404)) throw error;
  }
  const domain = text(organization, "auth_domain");
  if (domain === undefined) {
    throw new Error(
      "The account has no Zero Trust organization, which runs Cloudflare Access. Create one under Zero Trust in the Cloudflare dashboard: the Free plan is enough.",
    );
  }
  return `https://${domain}`;
}

/**
 * Runs a cf command that creates a resource, and returns what Cloudflare answered. A failure that
 * may pass can come after Cloudflare made the resource, so before the command runs again, the
 * stack waits and looks for the resource, and takes it when it is there: it never makes two.
 */
function createOnce(cf: Cf, args: readonly string[], find: () => unknown): unknown {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return cf.json(args, { retry: false });
    } catch (error) {
      if (attempt >= CF_ATTEMPTS || !isPassingCfError(error)) throw error;
      cf.pause(CF_FIRST_DELAY_MS * 2 ** (attempt - 1));
      const found = find();
      if (found !== undefined && found !== null) return found;
    }
  }
}

function accessApplications(cf: Cf): { id: string; domain: string }[] {
  return list(cf.json(["zero-trust", "access", "applications", "list"])).flatMap((item) => {
    const id = text(item, "id");
    const domain = text(item, "domain");
    return id === undefined || domain === undefined ? [] : [{ id, domain }];
  });
}

function readAccessApplication(raw: unknown): { id: string; aud: string } {
  const id = text(raw, "id");
  const aud = text(raw, "aud");
  if (id === undefined || aud === undefined) throw new Error("Cloudflare answered an Access application without an ID or an AUD tag.");
  return { id, aud };
}

function findWorker(cf: Cf, name: string): { id: string; hostname?: string } | null {
  try {
    const raw = cf.json(["workers", "get", name]);
    const id = text(raw, "id");
    if (id === undefined) throw new Error(`Cloudflare answered the Worker ${name} without an ID.`);
    const hostname = workerHostname(raw);
    return hostname === undefined ? { id } : { id, hostname };
  } catch (error) {
    if (error instanceof CfError && error.status === 404) return null;
    throw error;
  }
}

function workerHostname(raw: unknown): string | undefined {
  if (!isRecord(raw) || !isRecord(raw["subdomain"])) return undefined;
  const url = text(raw["subdomain"], "url");
  if (url !== undefined && URL.canParse(url)) return new URL(url).hostname;
  return undefined;
}

/** Derives <stack>.<account-subdomain>.workers.dev from another Worker in the account when possible. */
function workersDevDomainFromList(cf: Cf, stack: string): string | undefined {
  const items = list(cf.json(["workers", "list", "--per-page", "1"]));
  for (const item of items) {
    const name = text(item, "name");
    const hostname = workerHostname(item);
    if (name !== undefined && hostname !== undefined && hostname.startsWith(`${name}.`)) {
      return `${stack}.${hostname.slice(name.length + 1)}`;
    }
  }
  return undefined;
}

/** The tags that a resource has now. A resource that never had tags answers 500 during the beta of Resource Tagging. */
function readOwnTags(cf: Cf, resource: StackResource): Record<string, string> {
  try {
    // No retry: a 500 here is the answer for a resource without tags, which runs again in vain.
    const raw = cf.json(["tags", "account-resources", "get", "--resource-type", resource.type, "--resource-id", resource.id], { retry: false });
    const tags = isRecord(raw) ? raw["tags"] : undefined;
    if (!isRecord(tags)) return {};
    return Object.fromEntries(Object.entries(tags).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch (error) {
    if (error instanceof CfError && (error.status === 404 || error.status === 500)) return {};
    throw error;
  }
}

/** Sets the tags of a resource. Cloudflare replaces all of them, so `tags` holds the ones to keep too. */
function writeTags(cf: Cf, resource: StackResource, tags: Record<string, string>): void {
  cf.json(["tags", "account-resources", "update", "--body", JSON.stringify({ resource_type: resource.type, resource_id: resource.id, tags })]);
}

function key(resource: StackResource): string {
  return `${resource.type}/${resource.id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, field: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const found = value[field];
  return typeof found === "string" && found !== "" ? found : undefined;
}
