import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/job";
import { siteConfig } from "@/lib/site";

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    title: "Platform Engineer",
    company: "globex",
    location: "remote",
    department: "engineering",
    url: `https://boards.globex.com/${id}`,
    postedAt: new Date("2026-10-01T09:00:00.000Z"),
    source: "lever",
    ...overrides,
  };
}

const { mockGetRecentJobs } = vi.hoisted(() => ({ mockGetRecentJobs: vi.fn() }));

vi.mock("@/server/jobs/queries", () => ({
  getRecentJobs: (limit: number) => mockGetRecentJobs(limit),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { CACHE: null } }),
}));

vi.mock("@/server/api/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/api/rate-limit")>()),
  checkRateLimit: () => ({ allowed: true, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

async function feed(): Promise<{ res: Response; body: string }> {
  const { GET } = await import("./route");
  const res = await GET(new Request("https://evil.example/feed.xml"));
  return { res, body: await res.text() };
}

describe("GET /feed.xml", () => {
  beforeEach(() => {
    mockGetRecentJobs.mockReset();
  });

  it("serves an RSS 2.0 channel that points at the configured site", async () => {
    mockGetRecentJobs.mockResolvedValue([job("a1")]);
    const { res, body } = await feed();

    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    expect(body).toContain('<rss version="2.0"');
    expect(body).toContain(`<atom:link href="${siteConfig.url}/feed.xml"`);
    expect(body).not.toContain("evil.example");
    expect(body).toContain("<pubDate>Thu, 01 Oct 2026 09:00:00 GMT</pubDate>");
  });

  it("escapes ATS text so a hostile title can't break the XML", async () => {
    mockGetRecentJobs.mockResolvedValue([
      job("a1", { title: 'R&D <script>"x"</script>', company: "o'reilly" }),
    ]);
    const { body } = await feed();

    expect(body).toContain(
      "<title>R&amp;D &lt;script&gt;&quot;x&quot;&lt;/script&gt; at o&apos;reilly</title>",
    );
    expect(body).not.toContain("<script>");
  });

  it("lists at most the 100 newest jobs", async () => {
    mockGetRecentJobs.mockResolvedValue(Array.from({ length: 150 }, (_, i) => job(`j${i}`)));
    const { body } = await feed();

    expect(body.match(/<item>/g)).toHaveLength(100);
  });
});
