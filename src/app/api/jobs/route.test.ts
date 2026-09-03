import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/jobs/route";
import type { Job } from "@/lib/job";

function readJobs(res: Response): Promise<Job[]> {
  return res.json() as Promise<Job[]>;
}

const mockSearchJobsWithCount = vi.fn();

vi.mock("@/lib/db", () => ({
  searchJobsWithCount: (...args: unknown[]) => mockSearchJobsWithCount(...args),
}));

const { kvGet, kvPut } = vi.hoisted(() => ({
  kvGet: vi.fn(),
  kvPut: vi.fn(),
}));

const { waitUntil } = vi.hoisted(() => ({
  waitUntil: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: { CACHE: { get: kvGet, put: kvPut } },
    ctx: { waitUntil },
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
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
    experienceLevel: "senior",
  },
];

describe("GET /api/jobs", () => {
  beforeEach(() => {
    mockSearchJobsWithCount.mockReset();
    mockSearchJobsWithCount.mockResolvedValue({ jobs, total: jobs.length });
    kvGet.mockReset();
    kvPut.mockReset();
  });

  it("searches with empty filters when no params are given", async () => {
    kvGet.mockResolvedValue(undefined);
    const res = await GET(makeRequest());
    expect(mockSearchJobsWithCount).toHaveBeenCalledWith(
      {
        q: undefined,
        company: undefined,
        location: undefined,
        city: undefined,
        country: undefined,
        source: undefined,
        experience: undefined,
        posted: undefined,
        department: undefined,
        earlyCareer: undefined,
        sort: undefined,
      },
      { limit: undefined, offset: undefined },
    );
    expect(await readJobs(res)).toEqual(JSON.parse(JSON.stringify(jobs)));
  });

  it("passes free-text filters through", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(
      makeRequest({ q: "Designer", company: "Discord", location: "Remote", source: "Ashby" }),
    );
    expect(mockSearchJobsWithCount).toHaveBeenCalledWith(
      {
        q: "Designer",
        company: "Discord",
        location: "Remote",
        source: "Ashby",
        city: undefined,
        country: undefined,
        experience: undefined,
        posted: undefined,
        department: undefined,
        earlyCareer: undefined,
        sort: undefined,
      },
      { limit: undefined, offset: undefined },
    );
  });

  it("passes through enum filters untouched", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(makeRequest({ experience: "senior", posted: "week" }));
    expect(mockSearchJobsWithCount).toHaveBeenCalledWith(
      {
        q: undefined,
        company: undefined,
        location: undefined,
        city: undefined,
        country: undefined,
        source: undefined,
        experience: "senior",
        posted: "week",
        department: undefined,
        earlyCareer: undefined,
        sort: undefined,
      },
      { limit: undefined, offset: undefined },
    );
  });

  it("passes pagination params through", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(makeRequest({ limit: "50", offset: "100" }));
    expect(mockSearchJobsWithCount).toHaveBeenCalledWith(expect.anything(), {
      limit: 50,
      offset: 100,
    });
  });

  it("passes new facet filters through", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(
      makeRequest({
        department: "engineering",
        early_career: "true",
        sort: "company",
      }),
    );
    expect(mockSearchJobsWithCount).toHaveBeenCalledWith(
      expect.objectContaining({
        department: "engineering",
        earlyCareer: "true",
        sort: "company",
      }),
      { limit: undefined, offset: undefined },
    );
  });

  it("passes facet params through", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(makeRequest({ city: "bengaluru", country: "india" }));
    expect(mockSearchJobsWithCount).toHaveBeenCalledWith(
      expect.objectContaining({
        city: "bengaluru",
        country: "india",
      }),
      { limit: undefined, offset: undefined },
    );
  });
});

describe("GET /api/jobs KV cache", () => {
  beforeEach(() => {
    mockSearchJobsWithCount.mockReset();
    mockSearchJobsWithCount.mockResolvedValue({ jobs, total: jobs.length });
    kvGet.mockReset();
    kvPut.mockReset();
    waitUntil.mockReset();
  });

  it("serves from KV without touching the database", async () => {
    kvGet.mockResolvedValue(jobs);
    const res = await GET(makeRequest({ company: "discord" }));
    expect(res.headers.get("X-Total-Count")).toBe("1");
    expect(mockSearchJobsWithCount).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("falls back to database when KV is empty", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(makeRequest({ company: "discord" }));
    expect(mockSearchJobsWithCount).toHaveBeenCalledTimes(1);
  });

  it("restocks the KV cache in the background after a database fallback", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(makeRequest({ company: "discord" }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("ignores cache errors and queries the database", async () => {
    kvGet.mockRejectedValue(new Error("kv down"));
    const res = await GET(makeRequest());
    expect(await readJobs(res)).toEqual(JSON.parse(JSON.stringify(jobs)));
    expect(mockSearchJobsWithCount).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/jobs filter validation", () => {
  beforeEach(() => {
    mockSearchJobsWithCount.mockReset();
    mockSearchJobsWithCount.mockResolvedValue({ jobs: [], total: 0 });
    kvGet.mockReset();
  });

  it("rejects unknown posted windows with 400", async () => {
    const res = await GET(makeRequest({ posted: "fortnight" }));
    expect(res.status).toBe(400);
    expect(mockSearchJobsWithCount).not.toHaveBeenCalled();
  });

  it("accepts known posted windows", async () => {
    kvGet.mockResolvedValue(undefined);
    const res = await GET(makeRequest({ posted: "week" }));
    expect(res.status).toBe(200);
    expect(mockSearchJobsWithCount).toHaveBeenCalled();
  });

  it("rejects offsets beyond the deep-pagination cap", async () => {
    const res = await GET(makeRequest({ offset: "20000" }));
    expect(res.status).toBe(400);
    expect(mockSearchJobsWithCount).not.toHaveBeenCalled();
  });
});
