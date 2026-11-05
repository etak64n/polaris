// Keeps API results for a few minutes in the cache of the data center, so that
// reloading the page does not query Cloudflare analytics again.

export interface JsonCache {
  /** Returns the cached value of `key`, or computes it and keeps it for `seconds`. */
  get<T>(key: string, seconds: number, compute: () => Promise<T>): Promise<T>;
}

/** A cache that keeps nothing, for tests and for places without the Cache API. */
export const noCache: JsonCache = {
  get: (_key, _seconds, compute) => compute(),
};

/** The part of the Cache API that polestar uses. */
export interface CacheStore {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/** The Cache API of the Workers runtime. The keys are URLs on a hostname that only the Worker uses. */
export function edgeCache(cache: CacheStore): JsonCache {
  return {
    async get<T>(key: string, seconds: number, compute: () => Promise<T>): Promise<T> {
      const request = new Request(`https://polestar.cache/${encodeURIComponent(key)}`);
      const cached = await cache.match(request);
      if (cached !== undefined) return (await cached.json()) as T;
      const value = await compute();
      await cache.put(
        request,
        new Response(JSON.stringify(value), {
          headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${seconds}` },
        }),
      );
      return value;
    },
  };
}
