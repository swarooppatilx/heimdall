import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWorkableJobs } from "./workable";

const board = {
  name: "Deliveroo",
  jobs: [
    {
      title: "Senior Backend Engineer",
      shortcode: "A1B2C3D4",
      telecommuting: false,
      department: "Engineering",
      url: "https://apply.workable.com/j/A1B2C3D4",
      shortlink: "https://apply.workable.com/j/A1B2C3D4",
      published_on: "2026-08-10",
      city: "London",
      country: "United Kingdom",
      locations: [{ city: "London", country: "United Kingdom" }],
    },
    {
      title: "Support Engineer",
      shortcode: "E5F6G7H8",
      telecommuting: true,
      published_on: "2026-08-12",
    },
  ],
};

describe("fetchWorkableJobs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Workable job board API response to Job objects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(board)));

    const result = await fetchWorkableJobs("deliveroo");
    const jobs = result?.jobs ?? [];

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      id: "wb-deliveroo-A1B2C3D4",
      title: "Senior Backend Engineer",
      company: "deliveroo",
      location: "London, United Kingdom",
      source: "workable",
      isRemote: false,
    });
    expect(new Date(jobs[0]?.postedAt ?? 0).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("marks telecommuting roles as remote", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(board)));

    const result = await fetchWorkableJobs("deliveroo");
    const jobs = result?.jobs ?? [];

    expect(jobs[1]?.location).toBe("Remote");
    expect(jobs[1]?.isRemote).toBe(true);
  });

  it("throws on http errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    await expect(fetchWorkableJobs("nope")).rejects.toThrow("Failed to fetch jobs from nope: 404");
  });
});
