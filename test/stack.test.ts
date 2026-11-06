import { describe, expect, it } from "vitest";
import { validateSettings } from "../config/settings.ts";
import example from "../polaris.config.example.ts";
import { CfError, type Cf } from "../stack/cf.ts";
import { parseEnvFile } from "../stack/env-file.ts";
import { deleteStack, deployStack, STACK_TAG, stackResources, type StackResource } from "../stack/stack.ts";

const settings = validateSettings(example);
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
  it("creates the bucket and the Access application, deploys with the AUD tag, and tags each resource", () => {
    let deployed = false;
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "r2 buckets list") return { buckets: [{ name: "other-bucket" }] };
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

    expect(cf.callsOf("r2", "buckets", "create")).toEqual([["r2", "buckets", "create", "--name", "polaris-history"]]);
    const created = cf.callsOf("zero-trust", "access", "applications", "create")[0] ?? [];
    expect(JSON.parse(created[created.indexOf("--body") + 1] ?? "{}")).toEqual({
      name: "polaris",
      domain: "usage.example.com",
      type: "self_hosted",
      policies: [{ name: "Allowed people", decision: "allow", include: [{ email: { email: "you@example.com" } }] }],
    });
    expect(cf.callsOf("deploy")).toEqual([["deploy", "--secrets-file", "/tmp/polaris-test/secrets.json"]]);
    expect(written).toEqual([{ CLOUDFLARE_ACCOUNT_ID: SECRETS.accountId, ANALYTICS_API_TOKEN: "token", ACCESS_AUD: "aud-1" }]);
    expect(removed).toHaveLength(1);
    expect(tagBodies(cf)).toEqual([
      { resource_type: "r2_bucket", resource_id: "polaris-history", tags: { [STACK_TAG]: "polaris" } },
      { resource_type: "access_application", resource_id: "app-1", tags: { [STACK_TAG]: "polaris" } },
      { resource_type: "worker", resource_id: "worker-1", tags: { [STACK_TAG]: "polaris" } },
    ]);
    expect(resources.map((resource) => resource.type)).toEqual(["r2_bucket", "access_application", "worker"]);
  });

  it("keeps the bucket, updates the Access application of the domain, and keeps the other tags", () => {
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "r2 buckets list") return { buckets: [{ name: "polaris-history" }] };
      if (command === "zero-trust access applications") {
        if (args[3] === "list") return [{ id: "app-9", domain: settings.domain, aud: "aud-9" }];
        if (args[3] === "update") return { id: "app-9", aud: "aud-9" };
      }
      if (command === "workers get polaris") return { id: "worker-1", name: "polaris" };
      if (command === "tags account-resources get") return { tags: { owner: "platform" } };
      return {};
    });

    deployStack({ settings, secrets: SECRETS, cf, log: () => {}, writeSecretsFile: writeSecretsFile([], []) });

    expect(cf.callsOf("r2", "buckets", "create")).toEqual([]);
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
      { owner: "platform", [STACK_TAG]: "polaris" },
    ]);
  });

  it("changes nothing when a resource belongs to another stack", () => {
    const cf = new FakeCf((args) => {
      const command = args.slice(0, 3).join(" ");
      if (command === "r2 buckets list") return { buckets: [{ name: "polaris-history" }] };
      if (command === "zero-trust access applications") return [];
      if (command === "workers get polaris") return notFound(args);
      if (command === "tags account-resources get") return { tags: { [STACK_TAG]: "another-polaris" } };
      return {};
    });

    expect(() => deployStack({ settings, secrets: SECRETS, cf, log: () => {}, writeSecretsFile: writeSecretsFile([], []) })).toThrow(
      "R2 bucket polaris-history belongs to the stack another-polaris",
    );
    expect(cf.calls.filter((call) => call.some((word) => ["create", "update", "delete", "deploy"].includes(word)))).toEqual([]);
  });
});

describe("stackResources", () => {
  it("finds the resources by the tag of the stack, in the order of deletion", () => {
    const cf = new FakeCf(() => [
      { type: "r2_bucket", id: "polaris-history", name: "polaris-history" },
      { type: "worker", id: "worker-1", name: "polaris" },
      { type: "d1_database", id: "db-1", name: "notes" },
      { resource_type: "access_application", resource_id: "app-1", name: "usage.example.com" },
    ]);
    const { resources, others } = stackResources(cf, "polaris");
    expect(cf.calls).toEqual([["tags", "resources", "list", "--tag", `${STACK_TAG}=polaris`]]);
    expect(resources).toEqual([
      { type: "worker", id: "worker-1", name: "polaris" },
      { type: "access_application", id: "app-1", name: "usage.example.com" },
      { type: "r2_bucket", id: "polaris-history", name: "polaris-history" },
    ]);
    expect(others).toEqual(["d1_database notes"]);
  });
});

describe("deleteStack", () => {
  const resources: StackResource[] = [
    { type: "worker", id: "worker-1", name: "polaris" },
    { type: "access_application", id: "app-1", name: "polaris" },
    { type: "r2_bucket", id: "polaris-history", name: "polaris-history" },
  ];

  it("deletes the Worker, the Access application, and the bucket after emptying it", () => {
    let objects = ["daily/2026-10.json", "daily/2026-11.json"];
    let bucketDeleteTries = 0;
    const cf = new FakeCf((args) => {
      if (args[0] === "r2" && args[1] === "objects" && args[2] === "list") return objects.map((key) => ({ key }));
      if (args[0] === "r2" && args[1] === "objects" && args[2] === "bulk-delete") {
        objects = [];
        return {};
      }
      if (args.slice(0, 3).join(" ") === "r2 buckets delete") {
        bucketDeleteTries += 1;
        if (bucketDeleteTries === 1) return new CfError(args, "[10008] The bucket you tried to delete is not empty.\n409 Conflict · HTTP /accounts/x/r2/buckets/polaris-history");
      }
      return {};
    });
    const waits: number[] = [];

    deleteStack({ cf, log: () => {}, resources, wait: (milliseconds) => waits.push(milliseconds) });

    const untag = (type: string, id: string) => ["tags", "account-resources", "delete", "--resource-type", type, "--resource-id", id, "--force"];
    expect(cf.calls).toEqual([
      ["workers", "delete", "worker-1", "--force"],
      untag("worker", "worker-1"),
      ["zero-trust", "access", "applications", "delete", "app-1", "--force"],
      untag("access_application", "app-1"),
      ["r2", "objects", "list", "--bucket-name", "polaris-history", "--per-page", "1000"],
      ["r2", "objects", "bulk-delete", "--bucket-name", "polaris-history", "--body", JSON.stringify(["daily/2026-10.json", "daily/2026-11.json"]), "--force"],
      ["r2", "objects", "list", "--bucket-name", "polaris-history", "--per-page", "1000"],
      ["r2", "buckets", "delete", "polaris-history", "--force"],
      ["r2", "buckets", "delete", "polaris-history", "--force"],
      untag("r2_bucket", "polaris-history"),
    ]);
    expect(waits).toEqual([2000]);
  });

  it("counts a resource that is already gone as deleted, and removes its tag", () => {
    const gone = (args: string[]) => new CfError(args, "[11021] access.api.error.unknown_application\n404 Not Found · HTTP /accounts/x/access/apps/app-1");
    const cf = new FakeCf((args) => (args[0] === "tags" ? {} : gone(args)));
    const lines: string[] = [];

    deleteStack({ cf, log: (line) => lines.push(line), resources: [resources[1] as StackResource], wait: () => {} });

    expect(cf.calls.at(-1)).toEqual(["tags", "account-resources", "delete", "--resource-type", "access_application", "--resource-id", "app-1", "--force"]);
    expect(lines).toEqual(["Access application polaris: already gone"]);
  });

  it("stops when R2 keeps objects that it was asked to delete", () => {
    const cf = new FakeCf((args) => (args[2] === "list" ? [{ key: "locked.json" }] : {}));
    expect(() => deleteStack({ cf, log: () => {}, resources: [resources[2] as StackResource], wait: () => {} })).toThrow(
      "R2 did not delete the objects of the bucket polaris-history, such as locked.json.",
    );
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
