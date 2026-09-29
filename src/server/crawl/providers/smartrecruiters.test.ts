import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCrawlBudget } from "@/server/crawl/http";
import { fetchSmartRecruitersJobs } from "@/server/crawl/providers/smartrecruiters";

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

  it("maps SmartRecruiters postings API response to Job objects", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchSmartRecruitersJobs("testco");
    const jobs = result?.jobs ?? [];

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual({
      id: "sr-testco-sr-001",
      title: "Senior Engineer",
      company: "testco",
      location: "London, United Kingdom",
      locations: ["London, United Kingdom"],
      department: "Engineering",
      url: "https://careers.smartrecruiters.com/testco/aaaa-1111",
      postedAt: new Date("2026-08-15T12:00:00.000Z"),
      source: "smartrecruiters",
      isRemote: false,
      departmentHints: ["Backend"],
    });
  });

  it("leaves an empty department for ingest when department and function are empty", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchSmartRecruitersJobs("testco");
    const jobs = result?.jobs ?? [];

    expect(jobs[1]?.department).toBe("");
  });

  it("keeps SmartRecruiters' remote flag on remote postings", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(mockResponse));

    const result = await fetchSmartRecruitersJobs("testco");
    const jobs = result?.jobs ?? [];

    expect(jobs[1]?.location).toBe("Remote");
    expect(jobs[1]?.isRemote).toBe(true);
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
      .mockResolvedValueOnce(Response.json(page1))
      .mockResolvedValueOnce(Response.json(page2));

    const result = await fetchSmartRecruitersJobs("testco");
    const jobs = result?.jobs ?? [];

    expect(jobs).toHaveLength(150);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));

    await expect(fetchSmartRecruitersJobs("nope")).rejects.toThrow(
      "Failed to fetch jobs from nope: 404",
    );
  });

  it("calls the correct URL", async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ totalFound: 0, content: [] }));

    await fetchSmartRecruitersJobs("mycompany");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.smartrecruiters.com/v1/companies/mycompany/postings?limit=100&offset=0",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("fetchSmartRecruitersJobs budget", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the pages it reached, marked partial, when the budget runs out", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ...mockResponse, totalFound: 250 }), {
        headers: { "content-type": "application/json" },
      }),
    );
    const budget = createCrawlBudget();
    budget.used = 34;

    const result = await fetchSmartRecruitersJobs("testco", budget);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result?.jobs).toHaveLength(2);
    expect(result?.complete).toBe(false);
  });

  it("marks a board complete once the last page is in", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await fetchSmartRecruitersJobs("testco", createCrawlBudget());

    expect(result?.complete).toBe(true);
  });
});
