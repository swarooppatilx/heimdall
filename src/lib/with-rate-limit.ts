import { checkRateLimit, type RateLimitBinding, rateLimitResponse } from "./rate-limit";

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
    return handler(request);
  };
}
