import { describe, expect, it, vi } from "vitest";

const mockFacets = {
  remoteCount: 42,
  countries: [
    {
      value: "india",
      count: 30,
      cities: [
        { value: "bengaluru", count: 22 },
        { value: "hyderabad", count: 8 },
      ],
    },
    { value: "germany", count: 5, cities: [{ value: "berlin", count: 5 }] },
  ],
  departments: [{ value: "engineering", count: 120 }],
  sources: [
    { value: "greenhouse", count: 150 },
    { value: "lever", count: 1 },
  ],
  experienceLevels: [
    { value: "mid", count: 100 },
    { value: "senior", count: 60 },
  ],
};

vi.mock("@/lib/facet-cache", () => ({
  getFacetOptionsCached: async () => mockFacets,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { CACHE: {} } }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

describe("GET /api/filters", () => {
  it("serves count-backed facets with hierarchy", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/filters"));
    const data = (await res.json()) as typeof mockFacets;

    expect(data.remoteCount).toBe(42);
    expect(data.countries[0]).toMatchObject({ value: "india", count: 30 });
    expect(data.countries[0]?.cities[0]).toEqual({ value: "bengaluru", count: 22 });
  });
});
