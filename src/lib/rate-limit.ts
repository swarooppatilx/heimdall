import { getCloudflareContext } from "@opennextjs/cloudflare";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
const MS_PER_SECOND = 1_000;
const KV_PREFIX = "rl:";

export type RateLimitBinding = "JOBS_RATE_LIMITER" | "FILTERS_RATE_LIMITER" | "STATUS_RATE_LIMITER";

export interface RateLimitOptions {
  binding?: RateLimitBinding;
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  resetMs: number;
}

interface EdgeLimiter {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

async function getCacheBinding(): Promise<KVNamespace | undefined> {
  try {
    const { env } = await getCloudflareContext();
    return (env as CloudflareEnv).CACHE;
  } catch {
    return undefined;
  }
}

async function checkEdgeLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult | null> {
  if (!opts.binding) return null;
  try {
    const { env } = await getCloudflareContext();
    const limiter = (env as unknown as Record<string, unknown>)[opts.binding] as
      | EdgeLimiter
      | undefined;
    if (!limiter) return null;
    const result = await limiter.limit({ key });
    return { allowed: result.success, resetMs: opts.windowMs };
  } catch (err) {
    console.log("checkEdgeLimit: failed to access rate limiter", err);
    return null;
  }
}

function pruneTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

async function checkKvLimit(key: string, opts: RateLimitOptions): Promise<RateLimitResult | null> {
  if (!opts.binding) return null;
  const cache = await getCacheBinding();
  if (!cache) return null;
  const cacheKey = `${KV_PREFIX}${opts.binding}:${opts.windowMs}:${key}`;
  const ttlSeconds = Math.ceil(opts.windowMs / MS_PER_SECOND);
  try {
    const stored = await cache.get<number[]>(cacheKey, "json");
    const now = Date.now();
    const recent = stored ? pruneTimestamps(stored, opts.windowMs) : [];
    if (recent.length >= opts.max) {
      const oldest = recent[0];
      if (oldest === undefined) return { allowed: true, resetMs: 0 };
      return { allowed: false, resetMs: oldest + opts.windowMs - now };
    }
    recent.push(now);
    await cache.put(cacheKey, JSON.stringify(recent), { expirationTtl: ttlSeconds });
    return { allowed: true, resetMs: opts.windowMs };
  } catch (err) {
    console.log("checkKvLimit: failed to access kv rate limiter", err);
    return null;
  }
}

function cleanup(entry: RateLimitEntry, windowMs: number): void {
  entry.timestamps = pruneTimestamps(entry.timestamps, windowMs);
}

const MEMORY_PRUNE_THRESHOLD = 1000;

function pruneMemoryStore(windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  for (const [key, entry] of store) {
    if (!entry.timestamps.some((t) => t > cutoff)) store.delete(key);
  }
}

export async function checkRateLimit(
  request: Request,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = getClientIp(request);

  const edge = await checkEdgeLimit(key, opts);
  if (edge) return edge;

  const kv = await checkKvLimit(key, opts);
  if (kv) return kv;

  if (store.size >= MEMORY_PRUNE_THRESHOLD) pruneMemoryStore(opts.windowMs);

  let entry = store.get(key);
  if (!entry) {
    if (store.size >= MEMORY_PRUNE_THRESHOLD) {
      // unknown clients get rejected rather than growing an unbounded map
      return { allowed: false, resetMs: opts.windowMs };
    }
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  cleanup(entry, opts.windowMs);

  if (entry.timestamps.length >= opts.max) {
    const oldest = entry.timestamps[0];
    if (oldest === undefined) return { allowed: true, resetMs: 0 };
    return { allowed: false, resetMs: oldest + opts.windowMs - Date.now() };
  }

  entry.timestamps.push(Date.now());
  return { allowed: true, resetMs: opts.windowMs };
}

export function rateLimitResponse(resetMs: number): Response {
  return Response.json(
    { error: "rate limit exceeded", retryAfterMs: resetMs },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(resetMs / MS_PER_SECOND)),
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
