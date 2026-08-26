import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

const mocks = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    getCloudflareContext: vi.fn(async () => ({
      env: {
        CACHE: {
          get: (key: string, type?: string) => {
            const raw = store.get(key);
            if (type === "json" && raw != null) return JSON.parse(raw) as number[];
            return raw ?? null;
          },
          put: (key: string, value: string) => {
            store.set(key, value);
          },
        } as unknown as KVNamespace,
      },
    })),
  };
});

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

function fakeRequest(ip = "127.0.0.1"): Request {
  return new Request("http://localhost/api/test", {
    headers: { "cf-connecting-ip": ip },
  });
}

describe("checkRateLimit with KV binding", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.store.clear();
    vi.mocked(mocks.getCloudflareContext).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows request within limit via KV", async () => {
    const opts = { binding: "JOBS_RATE_LIMITER" as const, windowMs: 60_000, max: 2 };
    const first = await checkRateLimit(fakeRequest(), opts);
    const second = await checkRateLimit(fakeRequest(), opts);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(mocks.store.size).toBe(1);
  });

  it("blocks after exceeding limit via KV", async () => {
    const opts = { binding: "JOBS_RATE_LIMITER" as const, windowMs: 60_000, max: 2 };
    await checkRateLimit(fakeRequest(), opts);
    await checkRateLimit(fakeRequest(), opts);
    const blocked = await checkRateLimit(fakeRequest(), opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it("resets after window expires via KV", async () => {
    const opts = { binding: "JOBS_RATE_LIMITER" as const, windowMs: 10_000, max: 2 };
    await checkRateLimit(fakeRequest(), opts);
    await checkRateLimit(fakeRequest(), opts);
    const blocked = await checkRateLimit(fakeRequest(), opts);
    expect(blocked.allowed).toBe(false);
    vi.advanceTimersByTime(10_001);
    const reset = await checkRateLimit(fakeRequest(), opts);
    expect(reset.allowed).toBe(true);
  });

  it("tracks different IPs separately via KV", async () => {
    const opts = { binding: "JOBS_RATE_LIMITER" as const, windowMs: 60_000, max: 2 };
    const ip = "1.1.1.1";
    await checkRateLimit(fakeRequest(ip), opts);
    await checkRateLimit(fakeRequest(ip), opts);
    const blocked = await checkRateLimit(fakeRequest(ip), opts);
    const other = await checkRateLimit(fakeRequest("2.2.2.2"), opts);
    expect(blocked.allowed).toBe(false);
    expect(other.allowed).toBe(true);
    expect(mocks.store.size).toBe(2);
  });
});
