interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "127.0.0.1";
}

function cleanup(key: string, windowMs: number): void {
  const entry = store.get(key);
  if (!entry) return;
  const cutoff = Date.now() - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length === 0) store.delete(key);
}

export function checkRateLimit(
  request: Request,
  opts: { windowMs: number; max: number },
): { allowed: boolean; remaining: number; resetMs: number } {
  const ip = getClientIp(request);
  const key = ip;
  const now = Date.now();

  cleanup(key, opts.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  if (entry.timestamps.length >= opts.max) {
    const oldest = entry.timestamps[0]!;
    const resetMs = oldest + opts.windowMs - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: opts.max - entry.timestamps.length,
    resetMs: opts.windowMs,
  };
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
