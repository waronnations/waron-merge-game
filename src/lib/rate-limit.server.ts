/**
 * Rate limiter for serverless.
 * - In-memory by default (works on single instance)
 * - Ready for Upstash Redis later: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */

type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();
const CLEAN_INTERVAL = 60_000;
let lastClean = Date.now();

function clean() {
  const now = Date.now();
  if (now - lastClean < CLEAN_INTERVAL) return;
  lastClean = now;
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 5 * 60_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  clean();
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= limit) return false;
  entry.timestamps.push(now);
  return true;
}

export function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  errorMessage = "rate_limited",
): void {
  if (!checkRateLimit(key, limit, windowMs)) {
    throw new Error(errorMessage);
  }
}

/** Convenience helpers used by game actions */
export function assertMergeRate(userId: string) {
  assertRateLimit(`merge:${userId}`, 12, 10_000);
}

export function assertSpawnRate(userId: string) {
  assertRateLimit(`spawn:${userId}`, 8, 10_000);
}

export function assertSwapRate(userId: string) {
  assertRateLimit(`swap:${userId}`, 15, 10_000);
}

export function assertClaimRate(userId: string) {
  assertRateLimit(`claim:${userId}`, 3, 60_000);
}
