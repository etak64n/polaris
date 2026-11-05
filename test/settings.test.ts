import { describe, expect, it } from "vitest";
import { SettingsError, validateSettings, type PolestarSettings } from "../config/settings.ts";
import example from "../polestar.config.example.ts";

function settings(): PolestarSettings {
  return structuredClone(example);
}

function problemsOf(input: unknown): string[] {
  try {
    validateSettings(input);
  } catch (error) {
    if (error instanceof SettingsError) return error.problems;
    throw error;
  }
  throw new Error("The settings were accepted.");
}

describe("validateSettings", () => {
  it("accepts the example settings as they are", () => {
    expect(validateSettings(settings())).toEqual(example);
  });

  it("accepts the Paid plan and the last days of a month", () => {
    const input = settings();
    input.billing = { plan: "paid", cycleStartDay: 31 };
    expect(validateSettings(input).billing).toEqual({ plan: "paid", cycleStartDay: 31 });
  });

  it("writes the team domain as its origin", () => {
    const input = settings();
    input.access.teamDomain = "https://example.cloudflareaccess.com/";
    expect(validateSettings(input).access.teamDomain).toBe("https://example.cloudflareaccess.com");
  });

  it("lists every problem at once, in the order of the settings", () => {
    const input = { ...settings(), accountId: "ABC", billing: { plan: "pro", cycleStartDay: 0 }, extra: true };
    expect(problemsOf(input)).toEqual([
      "extra is not a setting that polestar reads.",
      "accountId must be a 32-character lowercase hexadecimal account ID.",
      'billing.plan must be "free" or "paid".',
      "billing.cycleStartDay must be a whole number from 1 to 31.",
    ]);
  });

  it("reports missing settings instead of using defaults", () => {
    expect(problemsOf({})).toEqual([
      "accountId is missing.",
      "workerName is missing.",
      "domain is missing.",
      "billing is missing.",
      "history is missing.",
      "access is missing.",
    ]);
  });

  it("rejects a bucket name that R2 does not accept and a team domain without https", () => {
    const input = settings();
    input.history.bucket = "Usage_History";
    input.access.teamDomain = "http://example.cloudflareaccess.com";
    expect(problemsOf(input)).toEqual([
      "history.bucket must be an R2 bucket name of 3 to 63 lowercase letters, digits, and hyphens.",
      "access.teamDomain must be an https:// origin.",
    ]);
  });
});
