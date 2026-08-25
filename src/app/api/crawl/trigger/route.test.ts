import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  crawlSlicesMock: vi.fn(),
  getAllFreshJobsMock: vi.fn(),
  writeAllJobsToKVMock: vi.fn(),
  warmFacetCacheMock: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: state.env }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

vi.mock("@/lib/crawler", () => ({
  crawlSlices: (...args: unknown[]) => state.crawlSlicesMock(...args),
}));

vi.mock("@/lib/db", () => ({
  bindDb: vi.fn(),
  getAllFreshJobs: (...args: unknown[]) => state.getAllFreshJobsMock(...args),
}));

vi.mock("@/lib/jobs-kv", () => ({
  writeAllJobsToKV: (...args: unknown[]) => state.writeAllJobsToKVMock(...args),
}));

vi.mock("@/lib/facet-cache", () => ({
  warmFacetCache: (...args: unknown[]) => state.warmFacetCacheMock(...args),
}));

vi.mock("@/lib/freshness", () => ({
  configureFreshness: vi.fn(),
}));

const okRun = {
  results: [{ company: "c0", status: "ok", jobsFound: 3, durationMs: 10 }],
  discovered: 3,
  durationMs: 10,
  skipped: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.crawlSlicesMock.mockResolvedValue([okRun]);
  state.getAllFreshJobsMock.mockResolvedValue([{ id: "j1" }]);
  state.writeAllJobsToKVMock.mockResolvedValue(undefined);
  state.warmFacetCacheMock.mockResolvedValue(undefined);
});

function post(path = "http://localhost/api/crawl/trigger", token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-crawl-trigger-token"] = token;
  return new Request(path, { method: "POST", headers });
}

describe("POST /api/crawl/trigger", () => {
  it("rejects when no trigger token is configured", async () => {
    state.env = {};
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(state.crawlSlicesMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched trigger token", async () => {
    state.env = { CRAWL_TRIGGER_TOKEN: "secret" };
    const { POST } = await import("./route");
    const res = await POST(post("http://localhost/api/crawl/trigger", "wrong"));
    expect(res.status).toBe(401);
    expect(state.crawlSlicesMock).not.toHaveBeenCalled();
  });

  it("runs the crawl and warms the caches with a valid token", async () => {
    state.env = { CRAWL_TRIGGER_TOKEN: "secret" };
    const { POST } = await import("./route");
    const res = await POST(post("http://localhost/api/crawl/trigger", "secret"));
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(state.crawlSlicesMock).toHaveBeenCalledWith(1);
    expect(state.writeAllJobsToKVMock).toHaveBeenCalled();
    expect(state.warmFacetCacheMock).toHaveBeenCalled();
    expect(body).toMatchObject({ ok: 1, failed: 0, discovered: 3, slices: 1, jobs: 1 });
  });

  it("honors and caps the slices parameter", async () => {
    state.env = { CRAWL_TRIGGER_TOKEN: "secret" };
    const { POST } = await import("./route");
    await POST(post("http://localhost/api/crawl/trigger?slices=4", "secret"));
    expect(state.crawlSlicesMock).toHaveBeenCalledWith(4);

    state.crawlSlicesMock.mockResolvedValueOnce([]);
    await POST(post("http://localhost/api/crawl/trigger?slices=999", "secret"));
    expect(state.crawlSlicesMock).toHaveBeenCalledWith(16);
  });
});
