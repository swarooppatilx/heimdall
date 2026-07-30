import { NextResponse } from "next/server";
import { formatError, logEvent } from "@/lib/logger";
import { checkRateLimit, type RateLimitBinding, rateLimitResponse } from "@/lib/rate-limit";

interface RateLimitConfig {
  binding: RateLimitBinding;
  windowMs: number;
  max: number;
}

export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const limit = await checkRateLimit(request, config);
    if (!limit.allowed) return rateLimitResponse(limit.resetMs);
    try {
      return await handler(request);
    } catch (err) {
      logEvent("api_error", {
        path: new URL(request.url).pathname,
        error: formatError(err),
      });
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
