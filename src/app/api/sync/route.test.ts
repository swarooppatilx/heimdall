import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/sync/route";

vi.mock("@/server/crawl/status", () => ({
  getSyncStatus: async () => ({ syncedAt: "2026-09-27T10:00:00.000Z" }),
}));

vi.mock("@/server/api/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/api/rate-limit")>()),
  checkRateLimit: () => ({ allowed: true, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

describe("GET /api/sync", () => {
  it("returns the last crawl time publicly without a token", async () => {
    const res = await GET(new Request("http://localhost/api/sync"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("public");
    await expect(res.json()).resolves.toEqual({ syncedAt: "2026-09-27T10:00:00.000Z" });
  });
});
