import { NextResponse } from "next/server";
import {
  checkRateLimit,
  RATE_LIMITS,
  type RateLimitBinding,
  rateLimitResponse,
} from "@/server/api/rate-limit";
import { formatError, logError } from "@/server/logger";

export interface ApiRequestTrackEvent {
  path: string;
  durationMs: number;
  status: number;
}

interface RouteConfig {
  binding: RateLimitBinding;
  onRequest?: (event: ApiRequestTrackEvent) => void;
}

export function defineRoute(
  config: RouteConfig,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const start = Date.now();
    const path = new URL(request.url).pathname;
    const limit = await checkRateLimit(request, {
      binding: config.binding,
      ...RATE_LIMITS[config.binding],
    });
    if (!limit.allowed) return rateLimitResponse(limit.resetMs);
    try {
      const response = await handler(request);
      config.onRequest?.({
        path,
        durationMs: Date.now() - start,
        status: response.status,
      });
      return response;
    } catch (err) {
      logError("api_error", {
        path,
        error: formatError(err),
      });
      config.onRequest?.({
        path,
        durationMs: Date.now() - start,
        status: 500,
      });
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}
