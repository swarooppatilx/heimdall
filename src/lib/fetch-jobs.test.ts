import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJobs } from "./fetch-jobs";

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
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(boardResponse(["Junior Backend Engineer", "Staff Engineer"])),
      }),
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

    expect(jobs[0]?.company).toBe("TestCo Inc");
  });

  it("keeps explicit early career flags from the provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
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
      }),
    );

    const jobs = await fetchJobs(entry);

    expect(jobs[0]).toMatchObject({ experienceLevel: "mid", isEarlyCareer: true });
  });

  it("drops jobs older than the freshness window", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
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
      }),
    );

    const jobs = await fetchJobs(entry);

    expect(jobs).toHaveLength(0);
  });

  it("drops jobs with invalid dates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            jobs: [
              {
                id: 4000,
                title: "Broken Posting",
                location: { name: "Remote" },
                absolute_url: "https://boards.greenhouse.io/testco/jobs/4000",
              },
            ],
          }),
      }),
    );

    const jobs = await fetchJobs(entry);

    expect(jobs).toHaveLength(0);
  });
});
