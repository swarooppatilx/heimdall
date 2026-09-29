import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGreenhouseJobs, formatSalaryRange } from "@/server/crawl/providers/greenhouse";

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

  it("maps Greenhouse board API response to Job objects", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchGreenhouseJobs("gitlab");
    const jobs = result?.jobs ?? [];

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "gh-gitlab-123",
      title: "Software Engineer",
      company: "gitlab",
      location: "Remote, US",
      locations: ["Remote, US"],
      department: "Engineering",
      url: "https://boards.greenhouse.io/gitlab/jobs/123",
      postedAt: new Date("2026-08-12T09:00:00.000Z"),
      source: "greenhouse",
      salary: "$120,000 – $160,000",
    });
  });

  it("prefers first_published over updated_at for freshness", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchGreenhouseJobs("gitlab");
    const jobs = result?.jobs ?? [];

    expect(jobs[0]?.postedAt.toISOString()).toBe("2026-08-12T09:00:00.000Z");
  });

  it("falls back to updated_at when first_published is missing", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchGreenhouseJobs("gitlab");
    const jobs = result?.jobs ?? [];

    expect(jobs[1]?.postedAt.toISOString()).toBe("2026-08-19T10:00:00.000Z");
  });

  it("leaves an empty department for ingest when metadata has none", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchGreenhouseJobs("gitlab");
    const jobs = result?.jobs ?? [];

    expect(jobs[1]?.department).toBe("");
  });

  it("passes location text through for ingest to resolve", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchGreenhouseJobs("gitlab");
    const jobs = result?.jobs ?? [];

    expect(jobs[0]?.location).toBe("Remote, US");
    expect(jobs[1]?.location).toBe("San Francisco, CA");
  });

  it("accepts metadata null, as Greenhouse sends for boards without custom fields", async () => {
    const [, second] = mockResponse.jobs;
    vi.mocked(fetch).mockResolvedValue(Response.json({ jobs: [{ ...second, metadata: null }] }));
    const result = await fetchGreenhouseJobs("gitlab");
    expect(result?.jobs).toHaveLength(1);
  });
});

describe("formatSalaryRange", () => {
  it("formats with the currency's own symbol", () => {
    expect(formatSalaryRange(120000, 160000, "USD")).toBe("$120,000 – $160,000");
    expect(formatSalaryRange(70000, 90000, "EUR")).toBe("€70,000 – €90,000");
  });

  it("falls back to bare numbers without a leading space when the currency is missing or unknown", () => {
    expect(formatSalaryRange(70000, 90000)).toBe("70,000 – 90,000");
    expect(formatSalaryRange(70000, 90000, "XX")).toBe("70,000 – 90,000");
  });
});
