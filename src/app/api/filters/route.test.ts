import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/db", () => ({
  getFilterOptions: () => ({
    companies: ["gitlab", "discord"],
    locations: ["Remote — United States", "San Francisco Bay Area"],
    sources: ["greenhouse", "ashby"],
  }),
}));

describe("GET /api/filters", () => {
  it("returns filter options from db", async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.companies).toEqual(["gitlab", "discord"]);
    expect(data.locations).toContain("Remote — United States");
    expect(data.sources).toEqual(["greenhouse", "ashby"]);
  });
});
