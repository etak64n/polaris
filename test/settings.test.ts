import { describe, expect, it } from "vitest";
import { SettingsError, validateSettings, type PolarisSettings } from "../config/settings.ts";
import example from "../polaris.config.example.ts";

function settings(): PolarisSettings {
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
  it("accepts the example settings without a custom domain", () => {
    expect(validateSettings(settings())).toEqual(example);
  });

  it("accepts an optional custom domain", () => {
    const input = { ...settings(), domain: "usage.example.com" };
    expect(validateSettings(input).domain).toBe("usage.example.com");
  });

  it("rejects an invalid custom domain", () => {
    const input = { ...settings(), domain: "https://usage.example.com" };
    expect(problemsOf(input)).toEqual(["domain must be a lowercase hostname without a scheme or path."]);
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
    const input = { ...settings(), workerName: "Polaris!", billing: { plan: "pro", cycleStartDay: 0 }, extra: true };
    expect(problemsOf(input)).toEqual([
      "extra is not a setting that polaris reads.",
      "workerName must be lowercase letters, digits, and hyphens (at most 63 characters).",
      'billing.plan must be "free" or "paid".',
      "billing.cycleStartDay must be a whole number from 1 to 31.",
    ]);
  });

  it("reports missing settings instead of using defaults", () => {
    expect(problemsOf({})).toEqual([
      "workerName is missing.",
      "billing is missing.",
      "access is missing.",
      "freeLimitLines is missing.",
    ]);
  });

  it("takes true or false for the lines of the Free plan", () => {
    const input = settings();
    input.freeLimitLines = false;
    expect(validateSettings(input).freeLimitLines).toBe(false);
    expect(problemsOf({ ...settings(), freeLimitLines: "yes" })).toEqual(["freeLimitLines must be true or false."]);
  });

  it("offers at least one login method", () => {
    const input = settings();
    input.access.loginMethods = [];
    expect(problemsOf(input)).toEqual(["access.loginMethods must name at least one login method."]);
  });

  it("names each login method once", () => {
    const input = settings();
    input.access.loginMethods = ["onetimepin", "github", "onetimepin"];
    expect(problemsOf(input)).toEqual(["access.loginMethods must name each login method once: onetimepin."]);
  });

  it("names login methods by a type or an ID without spaces", () => {
    const input = settings();
    input.access.loginMethods = ["one-time pin"];
    expect(problemsOf(input)).toEqual(['access.loginMethods must be a list of login method types or IDs, such as "onetimepin".']);
  });

  it("asks for at least one email address that may sign in", () => {
    const input = settings();
    input.access.allow = [];
    expect(problemsOf(input)).toEqual(["access.allow must be a list of one or more email addresses."]);
    input.access.allow = ["you@example.com", "not an address"];
    expect(problemsOf(input)).toEqual(["access.allow must be a list of one or more email addresses."]);
  });

  it("rejects a team domain without https", () => {
    const input = settings();
    input.access.teamDomain = "http://example.cloudflareaccess.com";
    expect(problemsOf(input)).toEqual(["access.teamDomain must be an https:// origin."]);
  });
});
