import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWorkdayJobs, postedAtFrom } from "./workday";

const ENDPOINT = "https://micron.wd1.myworkdayjobs.com/wday/cxs/micron/External/jobs";

function posting(i: number, overrides: Record<string, unknown> = {}) {
  return {
    title: `Engineer ${i}`,
    externalPath: `/job/San-Jose/1234567890${i}`,
    locationsText: "San Jose, CA, USA",
    postedOn: "Posted Today",
    ...overrides,
  };
}

function page(total: number, items: ReturnType<typeof posting>[]) {
  return {
    ok: true,
    json: () => Promise.resolve({ total, jobPostings: items }),
  };
}

describe("postedAtFrom", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-08-22T12:00:00.000Z") });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses relative workday dates", () => {
    expect(postedAtFrom("Posted Today").toISOString()).toBe("2026-08-22T12:00:00.000Z");
    expect(postedAtFrom("Posted Yesterday").toISOString()).toBe("2026-08-21T12:00:00.000Z");
    expect(postedAtFrom("Posted 3 Days Ago").toISOString()).toBe("2026-08-19T12:00:00.000Z");
    expect(postedAtFrom("Posted 30+ Days Ago").toISOString()).toBe("2026-07-23T12:00:00.000Z");
  });

  it("passes through absolute dates and rejects junk", () => {
    expect(postedAtFrom("2026-08-20T09:00:00.000Z").toISOString()).toBe("2026-08-20T09:00:00.000Z");
    expect(Number.isNaN(postedAtFrom("Posted Recently").getTime())).toBe(true);
  });
});

describe("fetchWorkdayJobs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps postings with derived urls and ids", async () => {
    vi.mocked(fetch).mockResolvedValue(page(1, [posting(7)]) as never);

    const jobs = await fetchWorkdayJobs(ENDPOINT);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: "wd-micron-12345678907",
      company: "micron",
      title: "Engineer 7",
      location: "san jose, ca, usa",
      region: "united states",
      url: "https://micron.wd1.myworkdayjobs.com/en-US/External/job/San-Jose/12345678907",
      source: "workday",
    });
  });

  it("posts json pages and paginates until total", async () => {
    const mock = vi.mocked(fetch);
    mock.mockImplementation((_url, init) => {
      const { offset } = JSON.parse(String(init?.body));
      if (offset === 0) return Promise.resolve(page(45, [posting(1)]) as never);
      if (offset === 20) return Promise.resolve(page(45, [posting(2)]) as never);
      return Promise.resolve(page(45, [posting(3), posting(4)]) as never);
    });

    const jobs = await fetchWorkdayJobs(ENDPOINT);

    expect(jobs).toHaveLength(4);
    const bodies = mock.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(bodies).toEqual([
      { limit: 20, offset: 0, searchText: "" },
      { limit: 20, offset: 20, searchText: "" },
      { limit: 20, offset: 40, searchText: "" },
    ]);
  });

  it("caps pagination at the page limit", async () => {
    const mock = vi.mocked(fetch);
    mock.mockImplementation((_url, init) => {
      const { offset } = JSON.parse(String(init?.body));
      return Promise.resolve(page(100_000, [posting(offset)]) as never);
    });

    const jobs = await fetchWorkdayJobs(ENDPOINT);

    expect(jobs.length).toBeLessThanOrEqual(200 * 20);
  });

  it("keeps successful pages when one page fails", async () => {
    const mock = vi.mocked(fetch);
    mock.mockImplementation((_url, init) => {
      const { offset } = JSON.parse(String(init?.body));
      if (offset === 20) return Promise.resolve({ ok: false, status: 500 } as never);
      return Promise.resolve(page(41, [posting(offset)]) as never);
    });

    const jobs = await fetchWorkdayJobs(ENDPOINT);

    expect(jobs.length).toBeGreaterThanOrEqual(2);
  });

  it("throws without an api url", async () => {
    await expect(fetchWorkdayJobs("")).rejects.toThrow("Missing workday api url");
  });
});
