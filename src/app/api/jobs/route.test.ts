import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/jobs/route";
import type { Job } from "@/lib/job";

const mockSearchJobsWithCount = vi.fn();

vi.mock("@/server/jobs/queries", () => ({
  searchJobsWithCount: (...args: unknown[]) => mockSearchJobsWithCount(...args),
}));

vi.mock("@/lib/search-params", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/search-params")>();
  return { ...original, POSTED_WINDOWS: ["today", "week"] };
});

vi.mock("@/server/api/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/api/rate-limit")>()),
  checkRateLimit: () => ({ allowed: true, remaining: 100, resetMs: 60_000 }),
  rateLimitResponse: () => new Response("rate limited", { status: 429 }),
}));

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/jobs");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url);
}

const jobs: Job[] = [
  {
    id: "1",
    title: "Senior Designer",
    company: "discord",
    location: "San Francisco Bay Area",
    department: "Design",
    url: "https://example.com/1",
    postedAt: new Date("2026-08-20"),
    source: "ashby",
  },
];

describe("GET /api/jobs", () => {
  beforeEach(() => {
    mockSearchJobsWithCount.mockReset();
    mockSearchJobsWithCount.mockResolvedValue({ jobs, total: jobs.length });
  });

  it("returns jobs as JSON with total count header", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Total-Count")).toBe("1");
    const body = (await res.json()) as Job[];
    expect(body).toHaveLength(1);
    expect(body[0]?.title).toBe("Senior Designer");
  });

  it("returns only the public job fields, never location facets or flags", async () => {
    mockSearchJobsWithCount.mockResolvedValue({
      jobs: [{ ...jobs[0], city: "san francisco", isRemote: false, locations: ["sf"] }],
      total: 1,
    });
    const body = (await (await GET(makeRequest())).json()) as Record<string, unknown>[];

    expect(Object.keys(body[0] ?? {}).sort()).toEqual([
      "company",
      "id",
      "location",
      "postedAt",
      "source",
      "title",
      "url",
    ]);
  });

  it("sends the total only with the first page", async () => {
    mockSearchJobsWithCount.mockResolvedValue({ jobs: [], total: null });
    const res = await GET(makeRequest({ offset: "50" }));
    expect(res.headers.get("X-Total-Count")).toBeNull();
  });

  it("returns empty array when no jobs match", async () => {
    mockSearchJobsWithCount.mockResolvedValue({ jobs: [], total: 0 });
    const res = await GET(makeRequest({ q: "nonexistent" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Job[];
    expect(body).toHaveLength(0);
    expect(res.headers.get("X-Total-Count")).toBe("0");
  });

  it("marks results cacheable at the edge under the jobs tag", async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(res.headers.get("Cache-Tag")).toBe("jobs");
  });

  it("returns 400 for invalid posted window", async () => {
    const res = await GET(makeRequest({ posted: "fortnight" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_posted");
  });

  it("returns 400 for offset beyond cap", async () => {
    const res = await GET(makeRequest({ offset: "20000" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("offset_too_large");
  });

  it("accepts valid posted window", async () => {
    const res = await GET(makeRequest({ posted: "week" }));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/jobs filter forwarding", () => {
  beforeEach(() => {
    mockSearchJobsWithCount.mockReset();
    mockSearchJobsWithCount.mockResolvedValue({ jobs: [], total: 0 });
  });

  it("passes free-text filters to query layer", async () => {
    await GET(makeRequest({ q: "Designer", company: "Discord" }));
    expect(mockSearchJobsWithCount).toHaveBeenCalled();
    const [filters] = mockSearchJobsWithCount.mock.calls[0] ?? [];
    expect(filters).toMatchObject({ q: "Designer", company: "Discord" });
  });

  it("passes pagination params to query layer", async () => {
    await GET(makeRequest({ limit: "50", offset: "100" }));
    expect(mockSearchJobsWithCount).toHaveBeenCalled();
    const [, page] = mockSearchJobsWithCount.mock.calls[0] ?? [];
    expect(page).toEqual({ limit: 50, offset: 100 });
  });

  it("passes facet filters to query layer", async () => {
    await GET(makeRequest({ department: "engineering", country: "india", sort: "company" }));
    expect(mockSearchJobsWithCount).toHaveBeenCalled();
    const [filters] = mockSearchJobsWithCount.mock.calls[0] ?? [];
    expect(filters).toMatchObject({
      department: "engineering",
      country: "india",
      sort: "company",
    });
  });
});
