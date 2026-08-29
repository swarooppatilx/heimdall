import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGreenhouseJobs } from "@/lib/providers/greenhouse";

const mockResponse = {
  jobs: [
    {
      id: 123,
      title: "Software Engineer",
      location: { name: "Remote, US" },
      updated_at: "2026-08-20T10:00:00.000Z",
      first_published: "2026-08-12T09:00:00.000Z",
      absolute_url: "https://boards.greenhouse.io/gitlab/jobs/123",
      metadata: [
        { name: "Department", value: "Engineering", value_type: "single_select" },
        {
          name: "Pay Transparency Range",
          value: { min: 120000, max: 160000, currency: "USD" },
          value_type: "currency_range",
        },
        { name: "Geography", value: "AMER", value_type: "single_select" },
        { name: "Early Career Time Type", value: null, value_type: "single_select" },
      ],
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
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "gh-gitlab-123",
      title: "Software Engineer",
      company: "gitlab",
      location: "us",
      locations: ["us"],
      department: "engineering",
      url: "https://boards.greenhouse.io/gitlab/jobs/123",
      postedAt: new Date("2026-08-12T09:00:00.000Z"),
      source: "greenhouse",
      salary: "$120,000 – $160,000",
      region: "amer",
      isEarlyCareer: false,
    });
  });

  it("prefers first_published over updated_at for freshness", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs[0]?.postedAt.toISOString()).toBe("2026-08-12T09:00:00.000Z");
  });

  it("falls back to updated_at when first_published is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs[1]?.postedAt.toISOString()).toBe("2026-08-19T10:00:00.000Z");
  });

  it("infers department from title when metadata is absent", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs[1]?.department).toBe("product");
  });

  it("normalizes location", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const jobs = await fetchGreenhouseJobs("gitlab");

    expect(jobs[0]?.location).toBe("us");
    expect(jobs[1]?.location).toBe("san francisco, ca");
  });
});
