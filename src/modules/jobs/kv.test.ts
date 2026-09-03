import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/modules/jobs/job";
import { getCompanyJobsFromKV } from "@/modules/jobs/kv";

const kvGet = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: { ANALYTICS: undefined } }),
}));

const jobs: Job[] = [
  {
    id: "3",
    title: "Discord Design",
    company: "discord",
    location: "Remote",
    department: "Design",
    url: "https://example.com/3",
    postedAt: new Date("2026-08-21"),
    source: "ashby",
    experienceLevel: "mid",
  },
  {
    id: "1",
    title: "Discord Eng",
    company: "discord",
    location: "Remote",
    department: "Engineering",
    url: "https://example.com/1",
    postedAt: new Date("2026-08-20"),
    source: "ashby",
    experienceLevel: "senior",
  },
  {
    id: "2",
    title: "Epic Designer",
    company: "epic games",
    location: "New York",
    department: "Design",
    url: "https://example.com/2",
    postedAt: new Date("2026-08-19"),
    source: "greenhouse",
    experienceLevel: "entry",
  },
];

const env = {
  CACHE: { get: kvGet, put: vi.fn() },
} as unknown as Parameters<typeof getCompanyJobsFromKV>[0];

describe("getCompanyJobsFromKV", () => {
  beforeEach(() => {
    kvGet.mockReset();
  });

  it("returns undefined when the KV snapshot is cold", async () => {
    kvGet.mockResolvedValue(undefined);
    await expect(getCompanyJobsFromKV(env, "discord")).resolves.toBeUndefined();
  });

  it("filters the snapshot by company, newest first, with the right total", async () => {
    kvGet.mockResolvedValue(jobs);
    const result = await getCompanyJobsFromKV(env, "discord");
    expect(result).toEqual({
      jobs: [expect.objectContaining({ id: "3" }), expect.objectContaining({ id: "1" })],
      total: 2,
    });
  });

  it("returns an empty result for a company absent from the snapshot", async () => {
    kvGet.mockResolvedValue(jobs);
    await expect(getCompanyJobsFromKV(env, "netflix")).resolves.toEqual({
      jobs: [],
      total: 0,
    });
  });
});
