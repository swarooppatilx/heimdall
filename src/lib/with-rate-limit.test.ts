import { afterEach, describe, expect, it, vi } from "vitest";
import { withRateLimit } from "@/lib/with-rate-limit";

vi.mock("./rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 10, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("withRateLimit", () => {
  it("passes successful handler responses through", async () => {
    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withRateLimit(
      { binding: "JOBS_RATE_LIMITER", windowMs: 60_000, max: 100 },
      handler,
    );

    const res = await wrapped(new Request("https://x.dev/api/jobs"));
    expect(res.status).toBe(200);
  });

  it("returns a json 500 and logs when the handler throws", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const wrapped = withRateLimit(
      { binding: "FILTERS_RATE_LIMITER", windowMs: 60_000, max: 30 },
      () => Promise.reject(new Error("d1 exploded")),
    );

    const res = await wrapped(new Request("https://x.dev/api/filters"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "internal_error" });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("api_error"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("d1 exploded"));
  });
});
