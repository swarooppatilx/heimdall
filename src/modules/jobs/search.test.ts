import { describe, expect, it } from "vitest";
import type { Job } from "@/modules/jobs/job";
import { searchJobs } from "@/modules/jobs/search";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "j1",
    title: "Frontend Engineer",
    company: "acme",
    location: "San Francisco, CA",
    department: "engineering",
    url: "https://example.com/j1",
    postedAt: new Date("2026-09-01"),
    source: "greenhouse",
    city: "san francisco",
    country: "united states",
    isRemote: false,
    experienceLevel: "mid",
    isEarlyCareer: false,
    ...overrides,
  };
}

const now = Date.now();
const DAY_MS = 86_400_000;

function recentJob(overrides: Partial<Job> = {}): Job {
  return makeJob({ postedAt: new Date(now - 2 * DAY_MS), ...overrides });
}

describe("searchJobs", () => {
  it("returns all jobs with no filters", () => {
    const jobs = [recentJob({ id: "j1" }), recentJob({ id: "j2" })];
    const result = searchJobs(jobs, {});
    expect(result.total).toBe(2);
    expect(result.jobs).toHaveLength(2);
  });

  it("filters by q (title match)", () => {
    const jobs = [
      recentJob({ id: "j1", title: "Frontend Engineer" }),
      recentJob({ id: "j2", title: "Backend Engineer" }),
    ];
    const result = searchJobs(jobs, { q: "frontend" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });

  it("filters by q (company match)", () => {
    const jobs = [
      recentJob({ id: "j1", company: "acme" }),
      recentJob({ id: "j2", company: "globex" }),
    ];
    const result = searchJobs(jobs, { q: "globex" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j2");
  });

  it("filters by company (exact after sanitize)", () => {
    const jobs = [
      recentJob({ id: "j1", company: "acme" }),
      recentJob({ id: "j2", company: "globex" }),
    ];
    const result = searchJobs(jobs, { company: "acme" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });

  it("filters by source", () => {
    const jobs = [
      recentJob({ id: "j1", source: "greenhouse" }),
      recentJob({ id: "j2", source: "lever" }),
    ];
    const result = searchJobs(jobs, { source: "greenhouse" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });

  it("filters by experience", () => {
    const jobs = [
      recentJob({ id: "j1", experienceLevel: "senior" }),
      recentJob({ id: "j2", experienceLevel: "entry" }),
    ];
    const result = searchJobs(jobs, { experience: "senior" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });

  it("filters by department", () => {
    const jobs = [
      recentJob({ id: "j1", department: "engineering" }),
      recentJob({ id: "j2", department: "design" }),
    ];
    const result = searchJobs(jobs, { department: "engineering" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });

  it("filters by earlyCareer", () => {
    const jobs = [
      recentJob({ id: "j1", isEarlyCareer: true }),
      recentJob({ id: "j2", isEarlyCareer: false }),
    ];
    const result = searchJobs(jobs, { earlyCareer: "true" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });

  it("filters by city", () => {
    const jobs = [
      recentJob({ id: "j1", city: "san francisco" }),
      recentJob({ id: "j2", city: "new york" }),
    ];
    const result = searchJobs(jobs, { city: "san francisco" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });

  it("filters by country", () => {
    const jobs = [
      recentJob({ id: "j1", country: "united states" }),
      recentJob({ id: "j2", country: "canada" }),
    ];
    const result = searchJobs(jobs, { country: "canada" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j2");
  });

  it("returns empty for non-matching filters", () => {
    const jobs = [recentJob({ id: "j1", company: "acme" })];
    const result = searchJobs(jobs, { company: "nonexistent" });
    expect(result.total).toBe(0);
    expect(result.jobs).toHaveLength(0);
  });

  it("combines multiple filters", () => {
    const jobs = [
      recentJob({ id: "j1", company: "acme", source: "greenhouse" }),
      recentJob({ id: "j2", company: "acme", source: "lever" }),
      recentJob({ id: "j3", company: "acme", source: "greenhouse", department: "design" }),
    ];
    const result = searchJobs(jobs, { company: "acme", source: "greenhouse" });
    expect(result.total).toBe(2);
  });
});

describe("searchJobs posted window", () => {
  it("filters by posted window", () => {
    const jobs = [
      recentJob({ id: "j1", postedAt: new Date(now - DAY_MS) }),
      recentJob({ id: "j2", postedAt: new Date(now - 20 * DAY_MS) }),
    ];
    const result = searchJobs(jobs, { posted: "week" });
    expect(result.total).toBe(1);
    expect(result.jobs[0]?.id).toBe("j1");
  });
});

describe("searchJobs sorting and pagination", () => {
  it("sorts by company when sort=company", () => {
    const jobs = [
      recentJob({ id: "j1", company: "zebra", postedAt: new Date(now - DAY_MS) }),
      recentJob({ id: "j2", company: "acme", postedAt: new Date(now - DAY_MS) }),
    ];
    const result = searchJobs(jobs, { sort: "company" });
    expect(result.jobs[0]?.company).toBe("acme");
    expect(result.jobs[1]?.company).toBe("zebra");
  });

  it("sorts by date (newest first) by default", () => {
    const jobs = [
      recentJob({ id: "j1", postedAt: new Date(now - 5 * DAY_MS) }),
      recentJob({ id: "j2", postedAt: new Date(now - DAY_MS) }),
    ];
    const result = searchJobs(jobs, {});
    expect(result.jobs[0]?.id).toBe("j2");
    expect(result.jobs[1]?.id).toBe("j1");
  });

  it("paginates with limit and offset", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => recentJob({ id: `j${i}` }));
    const result = searchJobs(jobs, {}, { limit: 3, offset: 2 });
    expect(result.jobs).toHaveLength(3);
    expect(result.total).toBe(10);
    expect(result.jobs[0]?.id).toBe("j2");
  });

  it("clamps limit to MAX_LIMIT", () => {
    const jobs = Array.from({ length: 5 }, (_, i) => recentJob({ id: `j${i}` }));
    const result = searchJobs(jobs, {}, { limit: 999_999 });
    expect(result.jobs).toHaveLength(5);
  });

  it("treats limit 0 as 1", () => {
    const jobs = [recentJob({ id: "j1" })];
    const result = searchJobs(jobs, {}, { limit: 0 });
    expect(result.jobs).toHaveLength(1);
  });
});
