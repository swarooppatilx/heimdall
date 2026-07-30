import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJobs } from "@/lib/fetch-jobs";

const entry = { name: "testco", provider: "greenhouse" };

function boardResponse(titles: string[]) {
  return {
    jobs: titles.map((title, i) => ({
      id: 1000 + i,
      title,
      location: { name: "Remote" },
      updated_at: "2026-08-15T12:00:00.000Z",
      absolute_url: `https://boards.greenhouse.io/testco/jobs/${1000 + i}`,
    })),
  };
}

describe("fetchJobs", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(boardResponse(["Junior Backend Engineer", "Staff Engineer"])),
        ),
    );
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("flags early career titles regardless of provider", async () => {
    const jobs = await fetchJobs(entry);

    expect(jobs[0]).toMatchObject({ experienceLevel: "entry", isEarlyCareer: true });
    expect(jobs[1]).toMatchObject({ experienceLevel: "staff", isEarlyCareer: false });
  });

  it("uses the registry label as company when present", async () => {
    const jobs = await fetchJobs({ ...entry, label: "TestCo Inc" });

    expect(jobs[0]?.company).toBe("testco inc");
  });

  it("keeps explicit early career flags from the provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jobs: [
            {
              id: 2000,
              title: "Product Engineer",
              location: { name: "Remote" },
              updated_at: "2026-08-15T12:00:00.000Z",
              absolute_url: "https://boards.greenhouse.io/testco/jobs/2000",
              metadata: [{ name: "Early Career", value: true, value_type: "boolean" }],
            },
          ],
        }),
      ),
    );

    const jobs = await fetchJobs(entry);

    expect(jobs[0]).toMatchObject({ experienceLevel: "mid", isEarlyCareer: true });
  });

  it("drops jobs older than the freshness window", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jobs: [
            {
              id: 3000,
              title: "Old Posting",
              location: { name: "Remote" },
              updated_at: "2026-01-01T12:00:00.000Z",
              absolute_url: "https://boards.greenhouse.io/testco/jobs/3000",
            },
          ],
        }),
      ),
    );

    const jobs = await fetchJobs(entry);

    expect(jobs).toHaveLength(0);
  });

  it("drops jobs with invalid dates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jobs: [
            {
              id: 4000,
              title: "Broken Posting",
              location: { name: "Remote" },
              absolute_url: "https://boards.greenhouse.io/testco/jobs/4000",
            },
          ],
        }),
      ),
    );

    const jobs = await fetchJobs(entry);

    expect(jobs).toHaveLength(0);
  });
});

describe("fetchJobs url validation", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("drops postings whose url is not a safe http(s) link", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          jobs: [
            {
              id: 1,
              title: "Safe Role",
              location: { name: "Remote" },
              updated_at: "2026-08-15T12:00:00.000Z",
              absolute_url: "https://boards.greenhouse.io/testco/jobs/1",
            },
            {
              id: 2,
              title: "Evil Role",
              location: { name: "Remote" },
              updated_at: "2026-08-15T12:00:00.000Z",
              absolute_url: "javascript:alert(1)",
            },
            {
              id: 3,
              title: "Broken Role",
              location: { name: "Remote" },
              updated_at: "2026-08-15T12:00:00.000Z",
              absolute_url: "not-a-url",
            },
          ],
        }),
      ),
    );

    const jobs = await fetchJobs(entry);

    expect(jobs.map((job) => job.title)).toEqual(["Safe Role"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("postings_invalid_url"));
    logSpy.mockRestore();
  });
});
