import { describe, expect, it } from "vitest";
import { memoryCache } from "../worker/cache.ts";

describe("memoryCache", () => {
  it("keeps a value for its seconds, then computes it again", async () => {
    let time = 0;
    const cache = memoryCache(() => time);
    let calls = 0;
    const compute = async () => {
      calls += 1;
      return calls;
    };
    expect(await cache.get("usage", 60, compute)).toBe(1);
    time = 59_999;
    expect(await cache.get("usage", 60, compute)).toBe(1);
    time = 60_000;
    expect(await cache.get("usage", 60, compute)).toBe(2);
  });

  it("keeps the values of different keys apart", async () => {
    const cache = memoryCache(() => 0);
    expect(await cache.get("a", 60, async () => "a")).toBe("a");
    expect(await cache.get("b", 60, async () => "b")).toBe("b");
    expect(await cache.get("a", 60, async () => "changed")).toBe("a");
  });

  it("shares one computation between requests that ask at once", async () => {
    const cache = memoryCache(() => 0);
    let calls = 0;
    let finish: (value: string) => void = () => {};
    const compute = () => {
      calls += 1;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    };
    const first = cache.get("usage", 60, compute);
    const second = cache.get("usage", 60, compute);
    finish("done");
    expect(await Promise.all([first, second])).toEqual(["done", "done"]);
    expect(calls).toBe(1);
  });

  it("keeps no failure, so the next request asks again", async () => {
    const cache = memoryCache(() => 0);
    await expect(
      cache.get("usage", 60, async () => {
        throw new Error("Cloudflare did not answer.");
      }),
    ).rejects.toThrow("Cloudflare did not answer.");
    expect(await cache.get("usage", 60, async () => "answered")).toBe("answered");
  });

  it("drops the oldest values past the most that it keeps", async () => {
    const cache = memoryCache(() => 0, 2);
    await cache.get("a", 60, async () => "a");
    await cache.get("b", 60, async () => "b");
    await cache.get("c", 60, async () => "c");
    expect(await cache.get("a", 60, async () => "a again")).toBe("a again");
    expect(await cache.get("c", 60, async () => "c again")).toBe("c");
  });
});
