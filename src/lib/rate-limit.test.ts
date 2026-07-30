import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

function fakeRequest(ip = "127.0.0.1"): Request {
  return new Request("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
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
});

describe("rateLimitResponse", () => {
  it("returns 429 with retry header", () => {
    const res = rateLimitResponse(5000);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });
});
