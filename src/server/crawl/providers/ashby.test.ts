import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAshbyJobs } from "@/server/crawl/providers/ashby";

const mockResponse = {
  jobs: [
    {
      id: "ash-001",
      title: "Frontend Engineer",
      department: "Engineering",
      location: "Remote - United States",
      isRemote: true,
      publishedAt: "2026-08-15T12:00:00.000Z",
      jobUrl: "https://jobs.ashbyhq.com/testco/ash-001",
    },
    {
      id: "ash-002",
      title: "Data Scientist",
      department: "",
      location: "San Francisco Bay Area",
      isRemote: false,
      publishedAt: "2026-08-14T12:00:00.000Z",
      jobUrl: "https://jobs.ashbyhq.com/testco/ash-002",
    },
  ],
};

describe("fetchAshbyJobs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps Ashby job board API response to Job objects", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchAshbyJobs("testco");
    const jobs = result?.jobs ?? [];

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "ab-testco-ash-001",
      title: "Frontend Engineer",
      company: "testco",
      location: "Remote - United States",
      locations: ["Remote - United States"],
      department: "Engineering",
      url: "https://jobs.ashbyhq.com/testco/ash-001",
      postedAt: new Date("2026-08-15T12:00:00.000Z"),
      source: "ashby",
      isRemote: true,
      departmentHints: [],
    });
  });

  it("leaves an empty department for ingest to resolve", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchAshbyJobs("testco");
    const jobs = result?.jobs ?? [];

    expect(jobs[1]?.department).toBe("");
  });

  it("passes location text through and keeps Ashby's remote flag", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchAshbyJobs("testco");
    const jobs = result?.jobs ?? [];

    expect(jobs[0]?.location).toBe("Remote - United States");
    expect(jobs[0]?.isRemote).toBe(true);
    expect(jobs[1]?.location).toBe("San Francisco Bay Area");
    expect(jobs[1]?.isRemote).toBe(false);
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));

    await expect(fetchAshbyJobs("nope")).rejects.toThrow("Failed to fetch jobs from nope: 403");
  });

  it("calls the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ jobs: [] }));

    await fetchAshbyJobs("mycompany");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.ashbyhq.com/posting-api/job-board/mycompany",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("accepts isRemote null, as Ashby sends for many postings", async () => {
    const [first] = mockResponse.jobs;
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ jobs: [{ ...first, isRemote: null, department: null }] }),
    );
    const result = await fetchAshbyJobs("testco");
    expect(result?.jobs).toHaveLength(1);
  });

  it("skips a malformed posting without failing the board", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const [first, second] = mockResponse.jobs;
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ jobs: [first, { ...second, title: undefined }] }),
    );
    const result = await fetchAshbyJobs("testco");
    expect(result?.jobs.map((job) => job.title)).toEqual(["Frontend Engineer"]);
  });
});
