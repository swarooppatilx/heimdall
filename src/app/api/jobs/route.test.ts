import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockJobs = [
  {
    id: "1",
    title: "Software Engineer",
    company: "gitlab",
    location: "Remote — United States",
    department: "Engineering",
    url: "https://example.com/1",
    postedAt: new Date("2026-08-20"),
    source: "greenhouse",
    experienceLevel: "mid",
  },
  {
    id: "2",
    title: "Senior Designer",
    company: "discord",
    location: "San Francisco Bay Area",
    department: "Design",
    url: "https://example.com/2",
    postedAt: new Date("2026-08-10"),
    source: "ashby",
    experienceLevel: "senior",
  },
  {
    id: "3",
    title: "Intern Engineer",
    company: "gitlab",
    location: "Remote — Canada",
    department: "Engineering",
    url: "https://example.com/3",
    postedAt: new Date("2026-08-18"),
    source: "greenhouse",
    experienceLevel: "intern",
  },
];

vi.mock("@/lib/db", () => ({
  getAllJobs: () => mockJobs,
}));

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/jobs");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url);
}

describe("GET /api/jobs", () => {
  it("returns all jobs with no filters", async () => {
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data).toHaveLength(3);
  });

  it("filters by query", async () => {
    const res = await GET(makeRequest({ q: "designer" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Senior Designer");
  });

  it("filters by company", async () => {
    const res = await GET(makeRequest({ company: "gitlab" }));
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by location", async () => {
    const res = await GET(makeRequest({ location: "remote" }));
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("filters by source", async () => {
    const res = await GET(makeRequest({ source: "ashby" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].source).toBe("ashby");
  });

  it("filters by experience level", async () => {
    const res = await GET(makeRequest({ experience: "senior" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].experienceLevel).toBe("senior");
  });

  it("filters by type remote", async () => {
    const res = await GET(makeRequest({ type: "remote" }));
    const data = await res.json();
    expect(data).toHaveLength(2);
  });

  it("combines multiple filters", async () => {
    const res = await GET(makeRequest({ company: "gitlab", type: "remote" }));
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.every((j: { company: string }) => j.company === "gitlab")).toBe(true);
  });

  it("is case insensitive for query", async () => {
    const res = await GET(makeRequest({ q: "SENIOR" }));
    const data = await res.json();
    expect(data).toHaveLength(1);
  });

  it("returns empty array when no matches", async () => {
    const res = await GET(makeRequest({ q: "nonexistent" }));
    const data = await res.json();
    expect(data).toHaveLength(0);
  });
});
