import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsertJobs = vi.fn();
const mockFetchJobs = vi.fn();

vi.mock("@/lib/db", () => ({
  upsertJobs: (...args: unknown[]) => mockUpsertJobs(...args),
}));

vi.mock("@/lib/registry", () => ({
  getRegistry: () => [
    { name: "gitlab", provider: "greenhouse", board: "gitlab" },
    { name: "discord", provider: "greenhouse", board: "discord" },
  ],
}));

vi.mock("@/lib/fetch-jobs", () => ({
  fetchJobs: (...args: unknown[]) => mockFetchJobs(...args),
}));

describe("POST /api/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs jobs from all providers", async () => {
    mockFetchJobs.mockResolvedValue([
      { id: "1", title: "Engineer", company: "gitlab", source: "greenhouse" },
    ]);

    const { POST } = await import("./route");
    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(2);
    expect(data.errors).toHaveLength(0);
    expect(mockUpsertJobs).toHaveBeenCalledTimes(2);
  });

  it("reports errors from failed providers", async () => {
    mockFetchJobs.mockRejectedValue(new Error("Network error"));

    const { POST } = await import("./route");
    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(0);
    expect(data.errors).toHaveLength(2);
    expect(data.errors[0]).toContain("gitlab");
    expect(data.errors[1]).toContain("discord");
  });

  it("handles partial failures", async () => {
    mockFetchJobs
      .mockResolvedValueOnce([{ id: "1", title: "Engineer" }])
      .mockRejectedValueOnce(new Error("fail"));

    const { POST } = await import("./route");
    const res = await POST();
    const data = await res.json();

    expect(data.synced).toBe(1);
    expect(data.errors).toHaveLength(1);
  });
});
