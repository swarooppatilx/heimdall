import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MS_PER_SECOND } from "@/lib/time";
import { formatError, logError } from "@/server/logger";

interface RateLimitEntry {
  timestamps: number[];
}

// The Workers rate-limit bindings enforce limits at the edge. When a binding is
// absent (local dev, a preview without one), this in-memory map is a
// per-isolate fallback. There is deliberately no KV tier: a KV write per request
// would spend the 1,000 writes/day Free allowance within minutes of traffic.
const store = new Map<string, RateLimitEntry>();

export type RateLimitBinding = "JOBS_RATE_LIMITER" | "FILTERS_RATE_LIMITER" | "STATUS_RATE_LIMITER";

const RATE_LIMIT_WINDOW_MS = 60 * MS_PER_SECOND;

// Mirrors the `ratelimits` bindings in wrangler.jsonc so the in-memory
// fallback (local dev, previews without bindings) enforces the same numbers.
export const RATE_LIMITS: Record<RateLimitBinding, { windowMs: number; max: number }> = {
  JOBS_RATE_LIMITER: { windowMs: RATE_LIMIT_WINDOW_MS, max: 100 },
  FILTERS_RATE_LIMITER: { windowMs: RATE_LIMIT_WINDOW_MS, max: 30 },
  STATUS_RATE_LIMITER: { windowMs: RATE_LIMIT_WINDOW_MS, max: 30 },
};

interface RateLimitOptions {
  binding?: RateLimitBinding;
  windowMs: number;
  max: number;
}

interface RateLimitResult {
  allowed: boolean;
  resetMs: number;
}

function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

async function checkEdgeLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult | null> {
  if (!opts.binding) return null;
  try {
    const { env } = await getCloudflareContext();
    // Absent when a deployment or local setup has no `ratelimits` bindings.
    const limiter: RateLimit | undefined = env[opts.binding];
    if (!limiter) return null;
    const result = await limiter.limit({ key });
    return { allowed: result.success, resetMs: opts.windowMs };
  } catch (err) {
    logError("rate_limit_edge_error", { error: formatError(err) });
    return null;
  }
}

function pruneTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t > cutoff);
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
  const ip = getClientIp(request);

  const edge = await checkEdgeLimit(ip, opts);
  if (edge) return edge;

  // Each binding keeps its own budget, as the edge limiters do.
  const key = `${opts.binding ?? "default"}:${ip}`;

  if (store.size >= MEMORY_PRUNE_THRESHOLD) pruneMemoryStore(opts.windowMs);

  let entry = store.get(key);
  if (!entry) {
    // Still full of active clients after pruning: evict the oldest (Maps keep
    // insertion order) rather than turning every new client away.
    if (store.size >= MEMORY_PRUNE_THRESHOLD) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  entry.timestamps = pruneTimestamps(entry.timestamps, opts.windowMs);

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
    { error: "rate_limited", retryAfterMs: resetMs },
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
