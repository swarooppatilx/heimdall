import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, rateLimitResponse } from "@/server/api/rate-limit";

function fakeRequest(ip = "127.0.0.1"): Request {
  return new Request("http://localhost/api/test", {
    headers: { "cf-connecting-ip": ip },
  });
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    return () => vi.useRealTimers();
  });

  it("allows request within limit", async () => {
    const res = await checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 5 });
    expect(res.allowed).toBe(true);
    expect(res.resetMs).toBe(60_000);
  });

  it("blocks after exceeding limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      await checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 5 });
    }
    const res = await checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 5 });
    expect(res.allowed).toBe(false);
    expect(res.resetMs).toBeGreaterThan(0);
  });

  it("resets after window expires", async () => {
    for (let i = 0; i < 3; i += 1) {
      await checkRateLimit(fakeRequest(), { windowMs: 10_000, max: 3 });
    }
    vi.advanceTimersByTime(10_001);
    const res = await checkRateLimit(fakeRequest(), { windowMs: 10_000, max: 3 });
    expect(res.allowed).toBe(true);
  });

  it("tracks different IPs separately", async () => {
    for (let i = 0; i < 3; i += 1) {
      await checkRateLimit(fakeRequest("1.1.1.1"), { windowMs: 60_000, max: 3 });
    }
    const blocked = await checkRateLimit(fakeRequest("1.1.1.1"), { windowMs: 60_000, max: 3 });
    const other = await checkRateLimit(fakeRequest("2.2.2.2"), { windowMs: 60_000, max: 3 });
    expect(blocked.allowed).toBe(false);
    expect(other.allowed).toBe(true);
  });

  it("admits a new client even when the store is full of active ones", async () => {
    const limit = { windowMs: 60_000, max: 5 };
    for (let i = 0; i < 1000; i += 1)
      await checkRateLimit(fakeRequest(`10.0.${i >> 8}.${i & 255}`), limit);

    const newcomer = await checkRateLimit(fakeRequest("192.168.1.1"), limit);
    expect(newcomer.allowed).toBe(true);
  });

  it("keeps a separate budget per binding for the same client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const limit = { windowMs: 60_000, max: 2 };
    const filters = { ...limit, binding: "FILTERS_RATE_LIMITER" as const };
    await checkRateLimit(fakeRequest("3.3.3.3"), filters);
    await checkRateLimit(fakeRequest("3.3.3.3"), filters);

    const blocked = await checkRateLimit(fakeRequest("3.3.3.3"), filters);
    const jobs = await checkRateLimit(fakeRequest("3.3.3.3"), {
      ...limit,
      binding: "JOBS_RATE_LIMITER",
    });

    expect(blocked.allowed).toBe(false);
    expect(jobs.allowed).toBe(true);
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with retry header", () => {
    const res = rateLimitResponse(5000);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });
});
