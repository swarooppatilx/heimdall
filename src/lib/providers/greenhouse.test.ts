import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGreenhouseJobs } from "./greenhouse";

const mockResponse = {
  jobs: [
    {
      id: 123,
      title: "Software Engineer",
      location: { name: "Remote, US" },
      updated_at: "2026-08-20T10:00:00.000Z",
      absolute_url: "https://boards.greenhouse.io/gitlab/jobs/123",
      departments: [{ name: "Engineering" }],
    },
    {
      id: 456,
      title: "Product Manager",
      location: { name: "San Francisco, CA" },
      updated_at: "2026-08-19T10:00:00.000Z",
      absolute_url: "https://boards.greenhouse.io/gitlab/jobs/456",
      departments: [],
    },
  ],
};

describe("fetchGreenhouseJobs", () => {
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

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "gh-gitlab-123",
      title: "Software Engineer",
      company: "gitlab",
      location: "Remote — United States",
      department: "Engineering",
      url: "https://boards.greenhouse.io/gitlab/jobs/123",
      postedAt: new Date("2026-08-20T10:00:00.000Z"),
      source: "greenhouse",
    });
  });

  it("defaults department to General when empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs[1]!.department).toBe("General");
  });

  it("normalizes location", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs[0]!.location).toBe("Remote — United States");
    expect(jobs[1]!.location).toBe("San Francisco, CA");
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchGreenhouseJobs("nonexistent")).rejects.toThrow(
      "Failed to fetch jobs from nonexistent: 404",
    );
  });

  it("calls the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ jobs: [] }),
    } as Response);

    await fetchGreenhouseJobs("discord");

    expect(fetch).toHaveBeenCalledWith("https://boards-api.greenhouse.io/v1/boards/discord/jobs", {
      next: { revalidate: 3600 },
    });
  });
});
