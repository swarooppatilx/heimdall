import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAshbyJobs } from "@/lib/providers/ashby";

const mockResponse = {
  jobs: [
    {
      id: "ash-001",
      title: "Frontend Engineer",
      department: "Engineering",
      location: "Remote - United States",
      employmentType: "Full-time",
      isRemote: true,
      publishedAt: "2026-08-15T12:00:00.000Z",
      jobUrl: "https://jobs.ashbyhq.com/testco/ash-001",
    },
    {
      id: "ash-002",
      title: "Data Scientist",
      department: "",
      location: "San Francisco Bay Area",
      employmentType: "Contractor",
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

  it("fetches and maps jobs correctly", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchAshbyJobs("testco");

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "ab-testco-ash-001",
      title: "Frontend Engineer",
      company: "testco",
      location: "remote",
      locations: ["remote"],
      department: "engineering",
      employmentType: "full-time",
      url: "https://jobs.ashbyhq.com/testco/ash-001",
      postedAt: new Date("2026-08-15T12:00:00.000Z"),
      source: "ashby",
    });
  });

  it("infers department from title when empty", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchAshbyJobs("testco");

    expect(jobs[1]?.department).toBe("engineering");
  });

  it("normalizes location", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchAshbyJobs("testco");

    expect(jobs[0]?.location).toBe("remote");
    expect(jobs[1]?.location).toBe("san francisco bay area");
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
});
