import { NextResponse } from "next/server";
import { formatError, logEvent } from "@/lib/logger";
import { checkRateLimit, type RateLimitBinding, rateLimitResponse } from "@/lib/rate-limit";

export interface ApiRequestTrackEvent {
  path: string;
  durationMs: number;
  status: number;
  kvHit: boolean;
}

interface RateLimitConfig {
  binding: RateLimitBinding;
  windowMs: number;
  max: number;
  onRequest?: (event: ApiRequestTrackEvent) => void;
}

export function withRateLimit(
  config: RateLimitConfig,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const start = Date.now();
    const limit = await checkRateLimit(request, config);
    if (!limit.allowed) return rateLimitResponse(limit.resetMs);
    try {
      const response = await handler(request);
      config.onRequest?.({
        path: new URL(request.url).pathname,
        durationMs: Date.now() - start,
        status: response.status,
        kvHit: response.headers.get("x-cache") === "HIT",
      });
      return response;
    } catch (err) {
      logEvent("api_error", {
        path: new URL(request.url).pathname,
        error: formatError(err),
      });
      config.onRequest?.({
        path: new URL(request.url).pathname,
        durationMs: Date.now() - start,
        status: 500,
        kvHit: false,
      });
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
