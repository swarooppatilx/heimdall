import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/job";
import { GET } from "./route";

function readJobs(res: Response): Promise<Job[]> {
  return res.json() as Promise<Job[]>;
}

const mockSearchJobs = vi.fn();
const mockCountJobs = vi.fn();

vi.mock("@/lib/db", () => ({
  searchJobs: (...args: unknown[]) => mockSearchJobs(...args),
  countJobs: (...args: unknown[]) => mockCountJobs(...args),
}));

const { kvGet, kvPut } = vi.hoisted(() => ({
  kvGet: vi.fn(),
  kvPut: vi.fn(),
}));

vi.mock("@/lib/cache-kv", () => ({
  cacheKv: () => ({ get: kvGet, put: kvPut }),
  hashedCacheKey: async (_prefix: string, value: string) => `jobs:${value}`,
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
    mockSearchJobs.mockReset();
    mockSearchJobs.mockResolvedValue(jobs);
    mockCountJobs.mockReset();
    mockCountJobs.mockResolvedValue(jobs.length);
  });
  kvGet.mockReset();
  kvPut.mockReset();

  it("searches with empty filters when no params are given", async () => {
    const res = await GET(makeRequest());
    expect(mockSearchJobs).toHaveBeenCalledWith(
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
        employmentType: undefined,
        earlyCareer: undefined,
        sort: undefined,
      },
      { limit: undefined, offset: undefined },
    );
    expect(await readJobs(res)).toEqual(JSON.parse(JSON.stringify(jobs)));
  });

  it("passes free-text filters through", async () => {
    await GET(
      makeRequest({ q: "Designer", company: "Discord", location: "Remote", source: "Ashby" }),
    );
    expect(mockSearchJobs).toHaveBeenCalledWith(
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
        employmentType: undefined,
        earlyCareer: undefined,
        sort: undefined,
      },
      { limit: undefined, offset: undefined },
    );
  });

  it("passes through enum filters untouched", async () => {
    await GET(makeRequest({ experience: "senior", posted: "week" }));
    expect(mockSearchJobs).toHaveBeenCalledWith(
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
        employmentType: undefined,
        earlyCareer: undefined,
        sort: undefined,
      },
      { limit: undefined, offset: undefined },
    );
  });

  it("passes pagination params through", async () => {
    await GET(makeRequest({ limit: "50", offset: "100" }));
    expect(mockSearchJobs).toHaveBeenCalledWith(expect.anything(), { limit: 50, offset: 100 });
  });

  it("passes new facet filters through", async () => {
    await GET(
      makeRequest({
        department: "engineering",
        employment_type: "full time",
        early_career: "true",
        sort: "company",
      }),
    );
    expect(mockSearchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        department: "engineering",
        employmentType: "full time",
        earlyCareer: "true",
        sort: "company",
      }),
      { limit: undefined, offset: undefined },
    );
  });

  it("passes facet params through", async () => {
    await GET(makeRequest({ city: "bengaluru", country: "india" }));
    expect(mockSearchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        city: "bengaluru",
        country: "india",
      }),
      { limit: undefined, offset: undefined },
    );
  });
});

describe("GET /api/jobs response cache", () => {
  beforeEach(() => {
    mockSearchJobs.mockReset();
    mockSearchJobs.mockResolvedValue(jobs);
    mockCountJobs.mockReset();
    mockCountJobs.mockResolvedValue(jobs.length);
    kvGet.mockReset();
    kvPut.mockReset();
  });

  it("serves a cached page without touching the database", async () => {
    kvGet.mockResolvedValue({ total: 42, jobs });
    const res = await GET(makeRequest({ company: "discord" }));
    expect(res.headers.get("X-Total-Count")).toBe("42");
    expect(mockSearchJobs).not.toHaveBeenCalled();
    expect(mockCountJobs).not.toHaveBeenCalled();
  });

  it("writes fresh results into the cache on a miss", async () => {
    kvGet.mockResolvedValue(undefined);
    await GET(makeRequest({ company: "discord" }));
    expect(mockSearchJobs).toHaveBeenCalledTimes(1);
    expect(kvPut).toHaveBeenCalledWith(
      expect.stringMatching(/^jobs:/),
      JSON.stringify({ total: jobs.length, jobs }),
      { expirationTtl: 300 },
    );
  });

  it("ignores cache errors and queries the database", async () => {
    kvGet.mockRejectedValue(new Error("kv down"));
    const res = await GET(makeRequest());
    expect(await readJobs(res)).toEqual(JSON.parse(JSON.stringify(jobs)));
    expect(mockSearchJobs).toHaveBeenCalledTimes(1);
  });
});
