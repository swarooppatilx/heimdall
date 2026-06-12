import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  getFilterOptions: () => ({
    companies: ["gitlab", "discord"],
    locations: ["Remote — United States", "San Francisco Bay Area"],
    sources: ["greenhouse", "ashby"],
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

describe("GET /api/filters", () => {
  it("returns filter options from db", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/filters");
    const res = GET(req);
    const data = await res.json();

    expect(data.companies).toEqual(["gitlab", "discord"]);
    expect(data.locations).toContain("Remote — United States");
    expect(data.sources).toEqual(["greenhouse", "ashby"]);
  });
});
