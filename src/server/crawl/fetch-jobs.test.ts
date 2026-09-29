import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJobs } from "@/server/crawl/fetch-jobs";

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

  it("derives each job's level from its title", async () => {
    const jobs = (await fetchJobs(entry))?.jobs ?? [];

    expect(jobs.map((job) => job.level)).toEqual(["entry", "lead"]);
  });

  it("uses the registry label as company when present", async () => {
    const result = await fetchJobs({ ...entry, label: "TestCo Inc" });
    const jobs = result?.jobs ?? [];

    expect(jobs[0]?.company).toBe("testco inc");
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

    const result = await fetchJobs(entry);
    const jobs = result?.jobs ?? [];

    expect(jobs).toHaveLength(0);
  });
});

describe("fetchJobs date validation", () => {
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
              updated_at: "not-a-date",
              absolute_url: "https://boards.greenhouse.io/testco/jobs/4000",
            },
          ],
        }),
      ),
    );

    const result = await fetchJobs(entry);
    const jobs = result?.jobs ?? [];

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

    const result = await fetchJobs(entry);
    const jobs = result?.jobs ?? [];

    expect(jobs.map((job) => job.title)).toEqual(["Safe Role"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("postings_invalid_url"));
    logSpy.mockRestore();
  });
});

describe("fetchJobs location canonicalization", () => {
  function boardWithLocations(names: string[]) {
    return {
      jobs: names.map((name, i) => ({
        id: 3000 + i,
        title: "Platform Engineer",
        location: { name },
        updated_at: "2026-08-15T12:00:00.000Z",
        absolute_url: `https://boards.greenhouse.io/testco/jobs/${3000 + i}`,
      })),
    };
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function jobsFor(names: string[]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(boardWithLocations(names))));
    return (await fetchJobs(entry))?.jobs ?? [];
  }

  it("keeps the remote signal that the provider's text carries", async () => {
    const [job] = await jobsFor(["Remote, US"]);
    expect(job).toMatchObject({
      location: "remote, united states",
      country: "united states",
      isRemote: true,
    });
  });

  it("resolves accented city names to the canonical place", async () => {
    const [job] = await jobsFor(["München, Germany"]);
    expect(job).toMatchObject({ location: "munich, germany", city: "munich" });
  });

  it("keeps every office of a slash-separated posting", async () => {
    const [job] = await jobsFor(["Berlin / Munich"]);
    expect(job?.location).toBe("berlin, germany");
    expect(job?.locations).toEqual(["Berlin", "Munich"]);
  });
});

describe("fetchJobs role classification", () => {
  function boardWithDepartment(title: string, department: string) {
    return {
      jobs: [
        {
          id: 4000,
          title,
          location: { name: "Berlin" },
          updated_at: "2026-08-15T12:00:00.000Z",
          absolute_url: "https://boards.greenhouse.io/testco/jobs/4000",
          metadata: [{ name: "Department", value: department, value_type: "single_select" }],
        },
      ],
    };
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-08-20T12:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function jobFor(title: string, department: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(boardWithDepartment(title, department))),
    );
    return (await fetchJobs(entry))?.jobs[0];
  }

  it("trusts the ATS department over a title that suggests otherwise", async () => {
    expect((await jobFor("Solutions Engineer", "Sales"))?.department).toBe("sales");
  });

  it("falls back to the title and reports an org-unit department it can't map", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await jobFor("Senior Software Engineer", "Selectleaders"))?.department).toBe(
      "engineering",
    );
    expect(log.mock.calls.some(([line]) => String(line).includes('"taxonomy_unmapped"'))).toBe(
      true,
    );
  });
});
