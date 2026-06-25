import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/job";
import { GET } from "./route";

function readJobs(res: Response): Promise<Job[]> {
  return res.json() as Promise<Job[]>;
}

const mockSearchJobs = vi.fn();

vi.mock("@/lib/db", () => ({
  searchJobs: (...args: unknown[]) => mockSearchJobs(...args),
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
  });

  it("searches with empty filters when no params are given", async () => {
    const res = await GET(makeRequest());
    expect(mockSearchJobs).toHaveBeenCalledWith(
      {
        q: undefined,
        company: undefined,
        location: undefined,
        source: undefined,
        type: undefined,
        experience: undefined,
        posted: undefined,
        department: undefined,
        employmentType: undefined,
        earlyCareer: undefined,
        sort: undefined,
        region: undefined,
      },
      { limit: undefined, offset: undefined },
    );
    expect(await readJobs(res)).toEqual(JSON.parse(JSON.stringify(jobs)));
  });

  it("lowercases free-text filters", async () => {
    await GET(
      makeRequest({ q: "Designer", company: "Discord", location: "Remote", source: "Ashby" }),
    );
    expect(mockSearchJobs).toHaveBeenCalledWith(
      {
        q: "designer",
        company: "discord",
        location: "remote",
        source: "ashby",
        type: undefined,
        experience: undefined,
        posted: undefined,
        department: undefined,
        employmentType: undefined,
        earlyCareer: undefined,
        sort: undefined,
        region: undefined,
      },
      { limit: undefined, offset: undefined },
    );
  });

  it("passes through enum filters untouched", async () => {
    await GET(makeRequest({ type: "remote", experience: "senior", posted: "week" }));
    expect(mockSearchJobs).toHaveBeenCalledWith(
      {
        q: undefined,
        company: undefined,
        location: undefined,
        source: undefined,
        type: "remote",
        experience: "senior",
        posted: "week",
        department: undefined,
        employmentType: undefined,
        earlyCareer: undefined,
        sort: undefined,
        region: undefined,
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
        region: "north america",
      }),
    );
    expect(mockSearchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        department: "engineering",
        employmentType: "full time",
        earlyCareer: "true",
        sort: "company",
        region: "north america",
      }),
      { limit: undefined, offset: undefined },
    );
  });

  it("lowercases department region and employmentType consistently", async () => {
    await GET(
      makeRequest({
        department: "Engineering",
        employment_type: "Full Time",
        region: "North America",
      }),
    );
    expect(mockSearchJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        department: "engineering",
        employmentType: "full time",
        region: "north america",
      }),
      { limit: undefined, offset: undefined },
    );
  });
});
