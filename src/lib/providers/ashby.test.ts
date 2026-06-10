import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAshbyJobs } from "./ashby";

const mockResponse = {
  jobs: [
    {
      id: "ash-001",
      title: "Frontend Engineer",
      department: "Engineering",
      location: "Remote - United States",
      publishedAt: "2026-08-15T12:00:00.000Z",
      jobUrl: "https://jobs.ashbyhq.com/testco/ash-001",
    },
    {
      id: "ash-002",
      title: "Data Scientist",
      department: "",
      location: "San Francisco Bay Area",
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
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const jobs = await fetchAshbyJobs("testco");

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "ab-testco-ash-001",
      title: "Frontend Engineer",
      company: "testco",
      location: "Remote — United States",
      department: "Engineering",
      url: "https://jobs.ashbyhq.com/testco/ash-001",
      postedAt: new Date("2026-08-15T12:00:00.000Z"),
      source: "ashby",
    });
  });

  it("defaults department to General when empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const jobs = await fetchAshbyJobs("testco");

    expect(jobs[1]!.department).toBe("General");
  });

  it("normalizes location", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const jobs = await fetchAshbyJobs("testco");

    expect(jobs[0]!.location).toBe("Remote — United States");
    expect(jobs[1]!.location).toBe("San Francisco Bay Area");
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    await expect(fetchAshbyJobs("nope")).rejects.toThrow("Failed to fetch jobs from nope: 403");
  });

  it("calls the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [] }),
    } as Response);

    await fetchAshbyJobs("mycompany");

    expect(fetch).toHaveBeenCalledWith("https://api.ashbyhq.com/posting-api/job-board/mycompany", {
      next: { revalidate: 3600 },
    });
  });
});
