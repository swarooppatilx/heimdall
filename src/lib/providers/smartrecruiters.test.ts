import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSmartRecruitersJobs } from "./smartrecruiters";

const mockResponse = {
  totalFound: 2,
  content: [
    {
      id: "sr-001",
      name: "Senior Engineer",
      uuid: "aaaa-1111",
      releasedDate: "2026-08-15T12:00:00.000Z",
      company: { identifier: "testco" },
      location: {
        city: "London",
        region: "",
        country: "gb",
        fullLocation: "London, United Kingdom",
        remote: false,
      },
      department: { label: "Engineering" },
      function: { label: "Backend" },
    },
    {
      id: "sr-002",
      name: "Product Designer",
      uuid: "bbbb-2222",
      releasedDate: "2026-08-14T12:00:00.000Z",
      company: { identifier: "testco" },
      location: {
        city: "",
        region: "",
        country: "",
        fullLocation: "",
        remote: true,
      },
      department: {},
      function: {},
    },
  ],
};

describe("fetchSmartRecruitersJobs", () => {
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

    const jobs = await fetchSmartRecruitersJobs("testco");

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "sr-testco-sr-001",
      title: "Senior Engineer",
      company: "testco",
      location: "london, united kingdom",
      locations: ["london, united kingdom"],
      department: "engineering",
      url: "https://careers.smartrecruiters.com/testco/aaaa-1111",
      postedAt: new Date("2026-08-15T12:00:00.000Z"),
      source: "smartrecruiters",
      employmentType: "",
      region: "gb",
      isEarlyCareer: false,
    });
  });

  it("infers department when department and function are empty", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const jobs = await fetchSmartRecruitersJobs("testco");

    expect(jobs[1]!.department).toBe("product");
  });

  it("normalizes remote locations", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const jobs = await fetchSmartRecruitersJobs("testco");

    expect(jobs[1]!.location).toBe("remote");
  });

  it("paginates through multiple pages", async () => {
    const page1 = {
      totalFound: 150,
      content: Array.from({ length: 100 }, (_, i) => ({
        id: `p1-${i}`,
        name: `Job ${i}`,
        uuid: `uuid-${i}`,
        releasedDate: "2026-08-15T12:00:00.000Z",
        company: { identifier: "testco" },
        location: {
          city: "NYC",
          region: "",
          country: "us",
          fullLocation: "New York, US",
          remote: false,
        },
        department: { label: "Eng" },
        function: { label: "Dev" },
      })),
    };
    const page2 = {
      totalFound: 150,
      content: Array.from({ length: 50 }, (_, i) => ({
        id: `p2-${i}`,
        name: `Job ${100 + i}`,
        uuid: `uuid-${100 + i}`,
        releasedDate: "2026-08-15T12:00:00.000Z",
        company: { identifier: "testco" },
        location: {
          city: "NYC",
          region: "",
          country: "us",
          fullLocation: "New York, US",
          remote: false,
        },
        department: { label: "Eng" },
        function: { label: "Dev" },
      })),
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page1),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page2),
      } as Response);

    const jobs = await fetchSmartRecruitersJobs("testco");

    expect(jobs).toHaveLength(150);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(fetchSmartRecruitersJobs("nope")).rejects.toThrow(
      "Failed to fetch jobs from nope: 404",
    );
  });

  it("calls the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ totalFound: 0, content: [] }),
    } as Response);

    await fetchSmartRecruitersJobs("mycompany");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.smartrecruiters.com/v1/companies/mycompany/postings?limit=100&offset=0",
    );
  });
});
