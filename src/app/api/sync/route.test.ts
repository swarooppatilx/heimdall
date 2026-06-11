import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCrawlAll = vi.fn();

vi.mock("@/lib/crawler", () => ({
  crawlAll: (...args: unknown[]) => mockCrawlAll(...args),
}));

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs jobs from all providers", async () => {
    mockCrawlAll.mockResolvedValue([
      { company: "gitlab", status: "ok", jobsFound: 1, durationMs: 50 },
      { company: "discord", status: "ok", jobsFound: 1, durationMs: 40 },
    ]);

    const { POST } = await import("./route");
    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(2);
    expect(data.errors).toHaveLength(0);
  });

  it("reports errors from failed providers", async () => {
    mockCrawlAll.mockResolvedValue([
      { company: "gitlab", status: "error", jobsFound: 0, durationMs: 0, error: "Network error" },
      { company: "discord", status: "error", jobsFound: 0, durationMs: 0, error: "Network error" },
    ]);

    const { POST } = await import("./route");
    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(0);
    expect(data.errors).toHaveLength(2);
    expect(data.errors[0]).toContain("gitlab");
    expect(data.errors[1]).toContain("discord");
  });

  it("handles partial failures", async () => {
    mockCrawlAll.mockResolvedValue([
      { company: "gitlab", status: "ok", jobsFound: 1, durationMs: 30 },
      { company: "discord", status: "error", jobsFound: 0, durationMs: 0, error: "fail" },
    ]);

    const { POST } = await import("./route");
    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(1);
    expect(data.errors).toHaveLength(1);
  });
});
