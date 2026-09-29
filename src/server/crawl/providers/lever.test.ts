import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLeverJobs } from "@/server/crawl/providers/lever";

const mockResponse = [
  {
    id: "abc-123",
    text: "Backend Engineer",
    categories: {
      department: "Engineering",
      location: "Remote, US",
    },
    createdAt: 1724160000000,
    hostedUrl: "https://jobs.lever.co/example/abc-123",
  },
  {
    id: "def-456",
    text: "Designer",
    categories: {
      department: "",
      location: "",
    },
    createdAt: 1724073600000,
    hostedUrl: "https://jobs.lever.co/example/def-456",
  },
];

describe("fetchLeverJobs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps Lever postings API response to Job objects", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchLeverJobs("example");
    const jobs = result?.jobs ?? [];

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "lv-example-abc-123",
      title: "Backend Engineer",
      company: "example",
      location: "Remote, US",
      locations: ["Remote, US"],
      department: "Engineering",
      url: "https://jobs.lever.co/example/abc-123",
      postedAt: new Date(1724160000000),
      source: "lever",
      departmentHints: [],
    });
  });

  it("handles missing location and department", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchLeverJobs("example");
    const jobs = result?.jobs ?? [];

    expect(jobs[1]?.location).toBe("");
    expect(jobs[1]?.department).toBe("");
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    await expect(fetchLeverJobs("bad")).rejects.toThrow("Failed to fetch jobs from bad: 500");
  });

  it("calls the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json([]));

    await fetchLeverJobs("testco");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.lever.co/v0/postings/testco",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("accepts postings with no department or location category", async () => {
    const [first] = mockResponse;
    vi.mocked(fetch).mockResolvedValue(Response.json([{ ...first, categories: {} }]));
    const result = await fetchLeverJobs("example");
    expect(result?.jobs[0]?.location).toBe("");
  });
});
