import { describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/job";

const jobs: Job[] = [
  {
    id: "a1",
    title: "Senior Frontend Engineer",
    company: "acme",
    location: "Remote",
    department: "engineering",
    url: "https://boards.acme.dev/senior-frontend",
    postedAt: new Date("2026-08-28"),
    source: "greenhouse",
  },
  {
    id: "b2",
    title: "Platform Engineer",
    company: "globex",
    location: "",
    department: "engineering",
    url: "https://boards.globex.com/platform",
    postedAt: new Date("2026-08-29"),
    source: "lever",
  },
];

vi.mock("@/lib/job-queries", () => ({
  getAllFreshJobs: async () => jobs,
}));

vi.mock("@/lib/site", () => ({
  siteUrl: async () => "https://example.com",
}));

describe("GET /llms-full.txt", () => {
  it("lists fresh jobs as markdown starting with newest", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://example.com/llms-full.txt"));
    const body = await res.text();

    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toContain("s-maxage=1800");
    expect(body).toContain("# heimdall fresh jobs");
    expect(body).toContain("https://example.com/api/jobs");
    expect(body).toContain("- [Platform Engineer at globex](https://boards.globex.com/platform)");
    expect(body).toContain(
      "- [Senior Frontend Engineer at acme](https://boards.acme.dev/senior-frontend) - Remote",
    );
    expect(body.indexOf("Platform Engineer")).toBeLessThan(
      body.indexOf("Senior Frontend Engineer"),
    );
  });
});
