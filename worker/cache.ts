// Keeps API results for a few minutes in the memory of the Worker, so that reloading a
// page or opening another one does not query Cloudflare again.
//
// The Cache API of the Workers runtime is not available to a Worker behind Cloudflare
// Access, which polaris always is, so the results stay in the memory of the isolate. An
// isolate answers many requests in a row, and a new deployment starts new isolates, so a
// result never outlives the code that made it.

export interface JsonCache {
  /** Returns the cached value of `key`, or computes it and keeps it for `seconds`. */
  get<T>(key: string, seconds: number, compute: () => Promise<T>): Promise<T>;
}

/** A cache that keeps nothing, for tests. */
export const noCache: JsonCache = {
  get: (_key, _seconds, compute) => compute(),
};

/** The most results that the memory keeps. Past it, the oldest go first. */
const MAX_ENTRIES = 64;

/**
 * A cache in the memory of the isolate. Requests that ask for the same key at once share
 * one computation, and a computation that fails is not kept, so the next request tries
 * again. Requests share the values, so the callers never change them.
 */
export function memoryCache(now: () => number = Date.now, maxEntries: number = MAX_ENTRIES): JsonCache {
  const entries = new Map<string, { expires: number; value: Promise<unknown> }>();
  return {
    get<T>(key: string, seconds: number, compute: () => Promise<T>): Promise<T> {
      const time = now();
      for (const [cached, entry] of entries) if (entry.expires <= time) entries.delete(cached);
      const found = entries.get(key);
      if (found !== undefined) return found.value as Promise<T>;

      const value = compute();
      entries.set(key, { expires: time + seconds * 1000, value });
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      for (const oldest of entries.keys()) {
        if (entries.size <= maxEntries) break;
        entries.delete(oldest);
      }
      return value;
    },
  };
}
