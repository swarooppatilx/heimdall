import { getCloudflareContext } from "@opennextjs/cloudflare";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

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
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "127.0.0.1";
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "127.0.0.1";
}

async function checkEdgeLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult | null> {
  if (!opts.binding) return null;
  try {
    const { env } = await getCloudflareContext();
    const limiter = (env as CloudflareEnv)[opts.binding] as EdgeLimiter | undefined;
    if (!limiter) return null;
    const result = await limiter.limit({ key });
    return { allowed: result.success, resetMs: opts.windowMs };
  } catch {
    return null;
  }
}

function cleanup(entry: RateLimitEntry, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
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

  if (store.size >= MEMORY_PRUNE_THRESHOLD) pruneMemoryStore(opts.windowMs);

  let entry = store.get(key);
  if (!entry) {
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
        "Retry-After": String(Math.ceil(resetMs / 1000)),
        "Content-Type": "application/json",
      },
    },
  );
}
