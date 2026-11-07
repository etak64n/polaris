import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateSettings } from "../config/settings.ts";
import example from "../polaris.config.example.ts";
import { CfError, type Cf } from "../stack/cf.ts";
import { parseEnvFile, withEnvValue } from "../stack/env-file.ts";
import { TOKEN_PERMISSIONS, tokenFormUrl } from "../stack/token-form.ts";
import { deleteStack, deployStack, STACK_TAG, stackResources, type StackResource } from "../stack/stack.ts";

const settings = validateSettings({ ...example, domain: "usage.example.com" });
const ORGANIZATION = { name: "example", auth_domain: "example.cloudflareaccess.com" };
const SECRETS = { accountId: "0123456789abcdef0123456789abcdef", analyticsApiToken: "token" };

/** Answers cf commands from a function, and records every command. */
class FakeCf implements Cf {
  readonly calls: string[][] = [];
  readonly answer: (args: string[]) => unknown;

  constructor(answer: (args: string[]) => unknown) {
    this.answer = answer;
  }

  json(args: readonly string[]): unknown {
    this.calls.push([...args]);
    const answer = this.answer([...args]);
    if (answer instanceof Error) throw answer;
    return answer;
  }

  run(args: readonly string[]): void {
    this.calls.push([...args]);
  }

  /** The commands that start with these words. */
  callsOf(...words: string[]): string[][] {
    return this.calls.filter((call) => words.every((word, index) => call[index] === word));
  }
}

const notFound = (args: string[]) => new CfError(args, "[10007] This Worker does not exist on your account.\n404 Not Found · HTTP /accounts/x/workers/workers/polaris");
const untagged = (args: string[]) => new CfError(args, "500 Internal Server Error · HTTP /accounts/x/tags");

function tagBodies(cf: FakeCf): { resource_type: string; resource_id: string; tags: Record<string, string> }[] {
  return cf.callsOf("tags", "account-resources", "update").map((call) => JSON.parse(call[call.indexOf("--body") + 1] ?? "{}"));
}

function writeSecretsFile(written: Record<string, string>[], removed: string[]) {
  return (values: Record<string, string>) => {
    written.push(values);
    return { path: "/tmp/polaris-test/secrets.json", remove: () => removed.push("/tmp/polaris-test/secrets.json") };
  };
}

describe("deployStack", () => {
  it("creates the Access application, deploys with the AUD tag, and tags each resource", () => {
    let deployed = false;
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "zero-trust organization get") return ORGANIZATION;
      if (command === "zero-trust access applications") {
        if (args[3] === "list") return [{ id: "app-of-another-domain", domain: "other.example.com", aud: "x" }];
        if (args[3] === "create") return { id: "app-1", aud: "aud-1", domain: settings.domain };
      }
      if (command === "workers get polaris") return deployed ? { id: "worker-1", name: "polaris" } : notFound(args);
      if (command === "tags account-resources get") return untagged(args);
      return {};
    });
    const run = cf.run.bind(cf);
    cf.run = (args) => {
      run(args);
      deployed = true;
    };
    const written: Record<string, string>[] = [];
    const removed: string[] = [];

    const resources = deployStack({ settings, secrets: SECRETS, cf, log: () => {}, writeSecretsFile: writeSecretsFile(written, removed) });

    const created = cf.callsOf("zero-trust", "access", "applications", "create")[0] ?? [];
    expect(JSON.parse(created[created.indexOf("--body") + 1] ?? "{}")).toEqual({
      name: "polaris",
      domain: "usage.example.com",
      type: "self_hosted",
      policies: [{ name: "Allowed people", decision: "allow", include: [{ email: { email: "you@example.com" } }] }],
    });
    expect(cf.callsOf("deploy")).toEqual([["deploy", "--secrets-file", "/tmp/polaris-test/secrets.json"]]);
    expect(written).toEqual([
      {
        CLOUDFLARE_ACCOUNT_ID: SECRETS.accountId,
        ANALYTICS_API_TOKEN: "token",
        ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
        ACCESS_AUD: "aud-1",
      },
    ]);
    expect(removed).toHaveLength(1);
    expect(tagBodies(cf)).toEqual([
      { resource_type: "access_application", resource_id: "app-1", tags: { [STACK_TAG]: "polaris" } },
      { resource_type: "worker", resource_id: "worker-1", tags: { [STACK_TAG]: "polaris" } },
    ]);
    expect(resources.map((resource) => resource.type)).toEqual(["access_application", "worker"]);
  });

  it("resolves the workers.dev hostname when domain is omitted", () => {
    let deployed = false;
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "zero-trust organization get") return ORGANIZATION;
      if (command === "zero-trust access applications") {
        if (args[3] === "list") return [];
        if (args[3] === "create") return { id: "app-1", aud: "aud-1", domain: "polaris.acct.workers.dev" };
      }
      if (command === "workers get polaris") {
        return deployed
          ? { id: "worker-1", name: "polaris", subdomain: { url: "https://polaris.acct.workers.dev" } }
          : notFound(args);
      }
      if (command === "workers list --per-page") {
        return [{ id: "worker-0", name: "other", subdomain: { url: "https://other.acct.workers.dev" } }];
      }
      if (command === "tags account-resources get") return untagged(args);
      return {};
    });
    const run = cf.run.bind(cf);
    cf.run = (args) => {
      run(args);
      deployed = true;
    };
    const lines: string[] = [];

    deployStack({
      settings: validateSettings(example),
      secrets: SECRETS,
      cf,
      log: (line) => lines.push(line),
      writeSecretsFile: writeSecretsFile([], []),
    });

    const created = cf.callsOf("zero-trust", "access", "applications", "create")[0] ?? [];
    expect(JSON.parse(created[created.indexOf("--body") + 1] ?? "{}").domain).toBe("polaris.acct.workers.dev");
    expect(lines.at(-1)).toBe("\npolaris runs at https://polaris.acct.workers.dev/");
  });

  it("updates the Access application of the domain and keeps the other tags", () => {
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "zero-trust organization get") return ORGANIZATION;
      if (command === "zero-trust access applications") {
        if (args[3] === "list") return [{ id: "app-9", domain: settings.domain, aud: "aud-9" }];
        if (args[3] === "update") return { id: "app-9", aud: "aud-9" };
      }
      if (command === "workers get polaris") return { id: "worker-1", name: "polaris" };
      if (command === "tags account-resources get") return { tags: { owner: "platform" } };
      return {};
    });

    deployStack({ settings, secrets: SECRETS, cf, log: () => {}, writeSecretsFile: writeSecretsFile([], []) });

    expect(cf.callsOf("zero-trust", "access", "applications", "create")).toEqual([]);
    expect(cf.callsOf("zero-trust", "access", "applications", "update")[0]?.slice(0, 5)).toEqual([
      "zero-trust",
      "access",
      "applications",
      "update",
      "app-9",
    ]);
    expect(tagBodies(cf).map((body) => body.tags)).toEqual([
      { owner: "platform", [STACK_TAG]: "polaris" },
      { owner: "platform", [STACK_TAG]: "polaris" },
    ]);
  });

  it("changes nothing when a resource belongs to another stack", () => {
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "zero-trust access applications") return [{ id: "app-9", domain: settings.domain, aud: "aud-9" }];
      if (command === "workers get polaris") return notFound(args);
      if (command === "tags account-resources get") return { tags: { [STACK_TAG]: "another-polaris" } };
      return {};
    });

    expect(() => deployStack({ settings, secrets: SECRETS, cf, log: () => {}, writeSecretsFile: writeSecretsFile([], []) })).toThrow(
      "Access application polaris belongs to the stack another-polaris",
    );
    expect(cf.calls.filter((call) => call.some((word) => ["create", "update", "delete", "deploy"].includes(word)))).toEqual([]);
  });
  it("changes nothing when the account has no Zero Trust organization", () => {
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "zero-trust organization get") return new CfError(args, "404 Not Found · HTTP /accounts/x/access/organizations");
      if (command === "zero-trust access applications") return [];
      if (command === "workers get polaris") return notFound(args);
      return {};
    });

    expect(() => deployStack({ settings, secrets: SECRETS, cf, log: () => {}, writeSecretsFile: writeSecretsFile([], []) })).toThrow(
      "The account has no Zero Trust organization",
    );
    expect(cf.calls.filter((call) => call.some((word) => ["create", "update", "delete", "deploy"].includes(word)))).toEqual([]);
  });
});

describe("stackResources", () => {
  it("finds the resources by the tag of the stack, in the order of deletion", () => {
    const cf = new FakeCf(() => [
      { resource_type: "access_application", resource_id: "app-1", name: "polaris" },
      { type: "d1_database", id: "db-1", name: "notes" },
      { type: "worker", id: "worker-1", name: "polaris" },
    ]);
    const { resources, others } = stackResources(cf, "polaris");
    expect(cf.calls).toEqual([["tags", "resources", "list", "--tag", `${STACK_TAG}=polaris`]]);
    expect(resources).toEqual([
      { type: "worker", id: "worker-1", name: "polaris" },
      { type: "access_application", id: "app-1", name: "polaris" },
    ]);
    expect(others).toEqual(["d1_database notes"]);
  });
});

describe("deleteStack", () => {
  const resources: StackResource[] = [
    { type: "worker", id: "worker-1", name: "polaris" },
    { type: "access_application", id: "app-1", name: "polaris" },
  ];

  it("deletes the Worker, then the Access application, and removes their tags", () => {
    const cf = new FakeCf(() => ({}));
    deleteStack({ cf, log: () => {}, resources });
    const untag = (type: string, id: string) => ["tags", "account-resources", "delete", "--resource-type", type, "--resource-id", id, "--force"];
    expect(cf.calls).toEqual([
      ["workers", "delete", "worker-1", "--force"],
      untag("worker", "worker-1"),
      ["zero-trust", "access", "applications", "delete", "app-1", "--force"],
      untag("access_application", "app-1"),
    ]);
  });

  it("counts a resource that is already gone as deleted, and removes its tag", () => {
    const gone = (args: string[]) => new CfError(args, "[11021] access.api.error.unknown_application\n404 Not Found · HTTP /accounts/x/access/apps/app-1");
    const cf = new FakeCf((args) => (args[0] === "tags" ? {} : gone(args)));
    const lines: string[] = [];

    deleteStack({ cf, log: (line) => lines.push(line), resources: [resources[1] as StackResource] });

    expect(cf.calls.at(-1)).toEqual(["tags", "account-resources", "delete", "--resource-type", "access_application", "--resource-id", "app-1", "--force"]);
    expect(lines).toEqual(["Access application polaris: already gone"]);
  });
});

describe("parseEnvFile", () => {
  it("reads KEY=VALUE lines and skips comments and blank lines", () => {
    const values = parseEnvFile('# The account\nCLOUDFLARE_ACCOUNT_ID=abc\n\nANALYTICS_API_TOKEN="a=b"\nEMPTY=\n');
    expect([...values]).toEqual([
      ["CLOUDFLARE_ACCOUNT_ID", "abc"],
      ["ANALYTICS_API_TOKEN", "a=b"],
      ["EMPTY", ""],
    ]);
  });
});

describe("tokenFormUrl", () => {
  const ACCOUNT = "0123456789abcdef0123456789abcdef";

  it("opens the token form of the account in .env, with the name and the permissions of polaris", () => {
    const url = new URL(tokenFormUrl(ACCOUNT));
    expect(`${url.origin}${url.pathname}`).toBe(`https://dash.cloudflare.com/${ACCOUNT}/api-tokens/create`);
    expect(url.searchParams.get("name")).toBe("polaris");
    expect(JSON.parse(url.searchParams.get("permissionGroupKeys") ?? "[]")).toEqual(TOKEN_PERMISSIONS);
  });

  it("selects the same permissions as the quick link of the README", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const link = /\((https:\/\/dash\.cloudflare\.com\/\?to=\/:account\/api-tokens[^)]*)\)/.exec(readme)?.[1];
    expect(link).toBeDefined();
    expect(JSON.parse(new URL(link ?? "https://invalid").searchParams.get("permissionGroupKeys") ?? "[]")).toEqual(TOKEN_PERMISSIONS);
  });
});

describe("withEnvValue", () => {
  it("fills in the line of the key, and keeps the comments and the other values", () => {
    const text = "# The account\nCLOUDFLARE_ACCOUNT_ID=abc\n\n# The token\nANALYTICS_API_TOKEN=\n";
    expect(withEnvValue(text, "ANALYTICS_API_TOKEN", "cfat_new")).toBe(
      "# The account\nCLOUDFLARE_ACCOUNT_ID=abc\n\n# The token\nANALYTICS_API_TOKEN=cfat_new\n",
    );
  });

  it("adds the line when .env has no such key, after a last line without a newline too", () => {
    expect(withEnvValue("CLOUDFLARE_ACCOUNT_ID=abc\n", "ANALYTICS_API_TOKEN", "cfat_new")).toBe("CLOUDFLARE_ACCOUNT_ID=abc\nANALYTICS_API_TOKEN=cfat_new\n");
    expect(withEnvValue("CLOUDFLARE_ACCOUNT_ID=abc", "ANALYTICS_API_TOKEN", "cfat_new")).toBe("CLOUDFLARE_ACCOUNT_ID=abc\nANALYTICS_API_TOKEN=cfat_new\n");
  });

  it("keeps the line endings of Windows", () => {
    expect(withEnvValue("CLOUDFLARE_ACCOUNT_ID=abc\r\nANALYTICS_API_TOKEN=\r\n", "ANALYTICS_API_TOKEN", "cfat_new")).toBe(
      "CLOUDFLARE_ACCOUNT_ID=abc\r\nANALYTICS_API_TOKEN=cfat_new\r\n",
    );
  });
});
