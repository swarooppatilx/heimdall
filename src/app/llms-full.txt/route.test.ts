import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/job";
import { siteConfig } from "@/lib/site";

const jobs: Job[] = [
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
];

const { mockGetRecentJobs } = vi.hoisted(() => ({
  mockGetRecentJobs: vi.fn(),
}));

vi.mock("@/server/jobs/queries", () => ({
  getRecentJobs: (limit: number) => mockGetRecentJobs(limit),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { CACHE: null } }),
}));

describe("GET /llms-full.txt", () => {
  beforeEach(() => {
    mockGetRecentJobs.mockReset();
    mockGetRecentJobs.mockResolvedValue(jobs);
  });

  it("lists fresh jobs as markdown starting with newest", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://evil.example/llms-full.txt", { headers: { host: "evil.example" } }),
    );
    const body = await res.text();

    expect(mockGetRecentJobs).toHaveBeenCalledWith(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("# heimdall fresh jobs");
    // The site URL comes from config, never the request Host.
    expect(body).toContain(`${siteConfig.url}/api/jobs`);
    expect(body).not.toContain("evil.example");
    expect(body).toContain("- [Platform Engineer at globex](https://boards.globex.com/platform)");
    expect(body).toContain(
      "- [Senior Frontend Engineer at acme](https://boards.acme.dev/senior-frontend) - Remote",
    );
    expect(body.indexOf("Platform Engineer")).toBeLessThan(
      body.indexOf("Senior Frontend Engineer"),
    );
  });
});
