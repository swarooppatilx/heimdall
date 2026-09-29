import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  upcomingBoardsMock: vi.fn(),
  enqueueBoardsMock: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: state.env }),
}));

vi.mock("@/server/api/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/api/rate-limit")>()),
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

vi.mock("@/server/crawl/sources", () => ({ listCrawlableSources: async () => [] }));

vi.mock("@/server/crawl/scheduler", () => ({
  upcomingBoards: (...args: unknown[]) => state.upcomingBoardsMock(...args),
  TICKS_PER_SWEEP: 4,
}));

vi.mock("@/server/crawl/queue", () => ({
  enqueueBoards: (...args: unknown[]) => state.enqueueBoardsMock(...args),
}));

const queue = { sendBatch: vi.fn() };
const boards = [
  { name: "c0", provider: "greenhouse" },
  { name: "c1", provider: "lever" },
];

beforeEach(() => {
  vi.clearAllMocks();
  state.upcomingBoardsMock.mockReturnValue(boards);
  state.enqueueBoardsMock.mockResolvedValue(1);
});

function post(path = "http://localhost/api/crawl/trigger", token?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers["x-crawl-trigger-token"] = token;
  return new Request(path, { method: "POST", headers });
}

describe("POST /api/crawl/trigger", () => {
  it("rejects when no trigger token is configured", async () => {
    state.env = { CRAWL_QUEUE: queue };
    const { POST } = await import("./route");
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(state.enqueueBoardsMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched trigger token", async () => {
    state.env = { CRAWL_TRIGGER_TOKEN: "secret", CRAWL_QUEUE: queue };
    const { POST } = await import("./route");
    const res = await POST(post("http://localhost/api/crawl/trigger", "wrong"));
    expect(res.status).toBe(401);
    expect(state.enqueueBoardsMock).not.toHaveBeenCalled();
  });

  it("enqueues the next slice of boards with a valid token", async () => {
    state.env = { CRAWL_TRIGGER_TOKEN: "secret", CRAWL_QUEUE: queue };
    const { POST } = await import("./route");
    const res = await POST(post("http://localhost/api/crawl/trigger", "secret"));

    expect(res.status).toBe(200);
    expect(state.upcomingBoardsMock).toHaveBeenCalledWith([], 1);
    expect(state.enqueueBoardsMock).toHaveBeenCalledWith(queue, boards);
    await expect(res.json()).resolves.toEqual({ slices: 1, boards: 2, messages: 1 });
  });

  it("honors and caps the slices parameter", async () => {
    state.env = { CRAWL_TRIGGER_TOKEN: "secret", CRAWL_QUEUE: queue };
    const { POST } = await import("./route");
    await POST(post("http://localhost/api/crawl/trigger?slices=3", "secret"));
    expect(state.upcomingBoardsMock).toHaveBeenCalledWith([], 3);
    await POST(post("http://localhost/api/crawl/trigger?slices=999", "secret"));
    expect(state.upcomingBoardsMock).toHaveBeenCalledWith([], 4);
  });

  it("refuses to crawl where no queue is bound, such as previews", async () => {
    state.env = { CRAWL_TRIGGER_TOKEN: "secret" };
    const { POST } = await import("./route");
    const res = await POST(post("http://localhost/api/crawl/trigger", "secret"));
    expect(res.status).toBe(503);
    expect(state.enqueueBoardsMock).not.toHaveBeenCalled();
  });
});
