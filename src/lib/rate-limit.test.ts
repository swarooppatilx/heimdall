import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, rateLimitResponse } from "./rate-limit";

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

  it("allows request within limit", () => {
    const res = checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 5 });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(4);
  });

  it("blocks after exceeding limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 5 });
    }
    const res = checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 5 });
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
  });

  it("tracks remaining correctly", () => {
    checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 3 });
    checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 3 });
    const res = checkRateLimit(fakeRequest(), { windowMs: 60_000, max: 3 });
    expect(res.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit(fakeRequest(), { windowMs: 10_000, max: 3 });
    }
    vi.advanceTimersByTime(10_001);
    const res = checkRateLimit(fakeRequest(), { windowMs: 10_000, max: 3 });
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(2);
  });

  it("tracks different IPs separately", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit(fakeRequest("1.1.1.1"), { windowMs: 60_000, max: 3 });
    }
    const blocked = checkRateLimit(fakeRequest("1.1.1.1"), { windowMs: 60_000, max: 3 });
    expect(blocked.allowed).toBe(false);

    const allowed = checkRateLimit(fakeRequest("2.2.2.2"), { windowMs: 60_000, max: 3 });
    expect(allowed.allowed).toBe(true);
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with retry header", () => {
    const res = rateLimitResponse(5000);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });
});
