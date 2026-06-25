import { describe, expect, it, vi } from "vitest";

function readFilters(res: Response): Promise<{
  companies: string[];
  locations: string[];
  sources: string[];
  departments: string[];
  employmentTypes: string[];
  regions: string[];
}> {
  return res.json() as Promise<{
    companies: string[];
    locations: string[];
    sources: string[];
    departments: string[];
    employmentTypes: string[];
    regions: string[];
  }>;
}

vi.mock("@/lib/db", () => ({
  getFilterOptions: async () => ({
    companies: ["gitlab", "discord"],
    locations: ["Remote — United States", "San Francisco Bay Area"],
    sources: ["greenhouse", "ashby"],
    departments: ["engineering", "design", "sales"],
    employmentTypes: ["full time", "contract"],
    regions: ["north america"],
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

describe("GET /api/filters", () => {
  it("returns all filter options from db", async () => {
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/filters");
    const res = await GET(req);
    const data = await readFilters(res);

    expect(data.companies).toEqual(["gitlab", "discord"]);
    expect(data.locations).toContain("Remote — United States");
    expect(data.sources).toEqual(["greenhouse", "ashby"]);
    expect(data.departments).toEqual(["engineering", "design", "sales"]);
    expect(data.employmentTypes).toEqual(["full time", "contract"]);
    expect(data.regions).toEqual(["north america"]);
  });
});
