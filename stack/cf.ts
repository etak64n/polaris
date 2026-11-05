// Runs the Cloudflare CLI (cf) of this project. cf signs in once with
// `cf auth login`, and every command here uses that sign-in and the account in
// CLOUDFLARE_ACCOUNT_ID of .env.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** A cf command that ended with an error. */
export class CfError extends Error {
  readonly args: readonly string[];
  /** What cf printed, which holds the error that Cloudflare answered. */
  readonly output: string;

  constructor(args: readonly string[], output: string) {
    super(`cf ${args.join(" ")} failed.${output.trim() === "" ? "" : `\n${output.trim()}`}`);
    this.name = "CfError";
    this.args = args;
    this.output = output;
  }

  /** The HTTP status that Cloudflare answered, when cf printed one. */
  get status(): number | null {
    const match = /\b([45]\d\d) [A-Z][A-Za-z ]+/.exec(this.output);
    return match?.[1] === undefined ? null : Number(match[1]);
  }
}

export interface Cf {
  /** Runs a command that prints JSON, and returns the JSON. */
  json(args: readonly string[]): unknown;
  /** Runs a command that prints its progress on the terminal, such as cf deploy. */
  run(args: readonly string[]): void;
}

/** The cf that `pnpm install` put in the project, so every person runs the same version. */
export function projectCf(root: string): Cf {
  const command = join(root, "node_modules", ".bin", "cf");
  if (!existsSync(command)) throw new Error(`${command} does not exist. Run pnpm install first.`);
  return {
    json(args) {
      const result = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      if (result.error !== undefined) throw result.error;
      if (result.status !== 0) throw new CfError(args, `${result.stdout}${result.stderr}`);
      return result.stdout.trim() === "" ? null : (JSON.parse(result.stdout) as unknown);
    },
    run(args) {
      const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
      if (result.error !== undefined) throw result.error;
      if (result.status !== 0) throw new CfError(args, "");
    },
  };
}
