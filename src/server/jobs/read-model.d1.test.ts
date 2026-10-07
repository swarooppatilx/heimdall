import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Job } from "@/lib/job";
import { MS_PER_DAY } from "@/lib/time";
import { getFacetOptions } from "@/server/jobs/facets";
import { getJobsByIdPrefix, searchJobsWithCount } from "@/server/jobs/queries";
import { dedupeCrossSourceJobs, insertJobs } from "@/server/jobs/writes";
import { createTestD1 } from "@/server/testing/d1";

let db: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestD1());
}, 60_000);

afterAll(() => dispose());

beforeEach(async () => {
  await db.batch([
    db.prepare("DELETE FROM jobs"),
    db.prepare("DELETE FROM job_locations"),
    db.prepare("DELETE FROM jobs_fts"),
  ]);
});

const listedCompany = "acme";
const otherCompany = "globex";

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    title: "Platform Engineer",
    company: listedCompany,
    location: "berlin, germany",
    locations: ["berlin, germany"],
    department: "engineering",
    url: `https://example.com/${id}`,
    postedAt: new Date(),
    source: "greenhouse",
    city: "berlin",
    country: "germany",
    ...overrides,
  };
}

async function titlesFor(q: string): Promise<string[]> {
  const { jobs } = await searchJobsWithCount({ q });
  return jobs.map((j) => j.title).sort();
}

describe("search against D1", () => {
  it("matches every word and prefix-matches the last one", async () => {
    await insertJobs([
      job("gh-a-1", { title: "Senior Platform Engineer" }),
      job("gh-a-2", { title: "Platform Designer", department: "design" }),
      job("gh-a-3", { title: "Data Analyst" }),
    ]);

    expect(await titlesFor("platform eng")).toEqual(["Senior Platform Engineer"]);
    expect(await titlesFor("plat")).toEqual(["Platform Designer", "Senior Platform Engineer"]);
  });

  it("never matches searches against job ids", async () => {
    await insertJobs([job("gh-a-1")]);

    expect(await titlesFor("gh")).toEqual([]);
  });

  it("treats c++ as the word c, not every word starting with c", async () => {
    await insertJobs([
      job("gh-a-1", { title: "C++ Developer" }),
      job("gh-a-2", { title: "Commercial Lead" }),
    ]);

    expect(await titlesFor("c++")).toEqual(["C++ Developer"]);
  });
});

describe("filters against D1", () => {
  it("matches a title-cased company filter against the stored name", async () => {
    await insertJobs([job("gh-a-1"), job("gh-b-1", { company: otherCompany })]);

    const { jobs, total } = await searchJobsWithCount({ company: listedCompany.toUpperCase() });
    expect(total).toBe(1);
    expect(jobs[0]?.id).toBe("gh-a-1");
  });

  it("filters by city through the location facets", async () => {
    await insertJobs([
      job("gh-a-1"),
      job("gh-a-2", {
        location: "paris, france",
        locations: ["paris, france"],
        city: "paris",
        country: "france",
      }),
    ]);

    const { jobs } = await searchJobsWithCount({ location: "paris, france" });
    expect(jobs.map((j) => j.id)).toEqual(["gh-a-2"]);
  });
});

describe("paging and edge cases against D1", () => {
  it("pages through tied posting times without gaps or repeats", async () => {
    const postedAt = new Date();
    await insertJobs(Array.from({ length: 120 }, (_, i) => job(`gh-a-${i}`, { postedAt })));

    const seen: string[] = [];
    for (let offset = 0; offset < 120; offset += 50) {
      const { jobs } = await searchJobsWithCount({}, { limit: 50, offset });
      seen.push(...jobs.map((j) => j.id));
    }
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });

  it("counts matches on the first page only", async () => {
    await insertJobs(Array.from({ length: 60 }, (_, i) => job(`gh-a-${i}`)));

    expect((await searchJobsWithCount({}, { limit: 50 })).total).toBe(60);
    expect((await searchJobsWithCount({}, { limit: 50, offset: 50 })).total).toBeNull();
  });

  it("matches nothing for a query with no searchable words", async () => {
    await insertJobs([job("gh-a-1")]);

    expect((await searchJobsWithCount({ q: "+++" })).total).toBe(0);
  });

  it("filters by level", async () => {
    await insertJobs([job("gh-a-1", { level: "entry" }), job("gh-a-2", { level: "senior" })]);

    const { jobs } = await searchJobsWithCount({ level: "entry" });
    expect(jobs.map((j) => j.id)).toEqual(["gh-a-1"]);
  });

  it("finds a multi-office posting under each of its cities", async () => {
    await insertJobs([
      job("gh-a-1", { location: "berlin, germany", locations: ["Berlin", "Munich"] }),
    ]);

    const { jobs } = await searchJobsWithCount({ location: "munich, germany" });
    expect(jobs.map((j) => j.id)).toEqual(["gh-a-1"]);
  });

  it("finds remote and country-only jobs through a country filter", async () => {
    await insertJobs([
      job("gh-a-1", {
        location: "remote, germany",
        locations: ["remote, germany"],
        isRemote: true,
        country: "germany",
      }),
      job("gh-a-2", { location: "germany", locations: ["germany"], country: "germany" }),
      job("gh-a-3", {
        location: "paris, france",
        locations: ["paris, france"],
        city: "paris",
        country: "france",
      }),
    ]);

    const { jobs } = await searchJobsWithCount({ location: "germany" });
    expect(jobs.map((j) => j.id).sort()).toEqual(["gh-a-1", "gh-a-2"]);
  });

  it("never serves a stored job whose link isn't http(s)", async () => {
    await insertJobs([job("gh-a-1"), job("gh-a-2", { url: "javascript:alert(1)" })]);

    const { jobs } = await searchJobsWithCount({});
    expect(jobs.map((j) => j.id)).toEqual(["gh-a-1"]);
  });

  it("never returns expired jobs", async () => {
    await insertJobs([job("gh-a-1", { postedAt: new Date(Date.now() - 400 * MS_PER_DAY) })]);

    expect((await searchJobsWithCount({})).total).toBe(0);
  });
});

// bm25 weighs a word by how rare it is, and FTS5 all but zeroes a word found
// in most rows, so ranking needs rows that don't match, as a real index has.
function unrelatedJobs(): Job[] {
  return Array.from({ length: 8 }, (_, i) => job(`gh-z-${i}`, { title: "Data Analyst" }));
}

describe("ranked search against D1", () => {
  it("ranks a title match above a newer match on the company name", async () => {
    await insertJobs([
      job("gh-a-1", { title: "React Engineer", postedAt: new Date(Date.now() - 5 * MS_PER_DAY) }),
      job("gh-a-2", { title: "Backend Engineer", company: "react labs" }),
      ...unrelatedJobs(),
    ]);

    const ranked = await searchJobsWithCount({ q: "react" });
    expect(ranked.jobs.map((j) => j.id)).toEqual(["gh-a-1", "gh-a-2"]);
    expect(ranked.total).toBe(2);

    const newest = await searchJobsWithCount({ q: "react", sort: "newest" });
    expect(newest.jobs.map((j) => j.id)).toEqual(["gh-a-2", "gh-a-1"]);
  });

  it("applies filters to a ranked search", async () => {
    await insertJobs([
      job("gh-a-1", { title: "React Engineer", level: "senior" }),
      job("gh-a-2", { title: "React Engineer", level: "mid" }),
    ]);

    const { jobs } = await searchJobsWithCount({ q: "react", level: "mid" });
    expect(jobs.map((j) => j.id)).toEqual(["gh-a-2"]);
  });

  it("pages through a ranked search with tied scores without gaps or repeats", async () => {
    const postedAt = new Date();
    await insertJobs(
      Array.from({ length: 120 }, (_, i) =>
        job(`gh-a-${i}`, { title: "React Engineer", postedAt }),
      ),
    );

    const seen: string[] = [];
    for (let offset = 0; offset < 120; offset += 50) {
      const { jobs } = await searchJobsWithCount({ q: "react" }, { limit: 50, offset });
      seen.push(...jobs.map((j) => j.id));
    }
    expect(new Set(seen).size).toBe(120);
  });
});

describe("board lookups and cleanup against D1", () => {
  it("loads one board's jobs without the board that shares its prefix", async () => {
    await insertJobs([job("gh-doordash-1"), job("gh-doordashusa-1")]);

    const jobs = await getJobsByIdPrefix("gh-doordash-");
    expect(jobs.map((j) => j.id)).toEqual(["gh-doordash-1"]);
  });

  it("dedupes a role across sources even when the title's case differs", async () => {
    const earlier = new Date(Date.now() - MS_PER_DAY);
    await insertJobs([
      job("gh-a-1", { title: "Platform Engineer", postedAt: earlier }),
      job("lv-a-1", { title: "platform engineer", source: "lever" }),
    ]);

    expect(await dedupeCrossSourceJobs()).toBe(1);
  });

  it("keeps the earliest posting of a role listed on two sources", async () => {
    const earlier = new Date(Date.now() - MS_PER_DAY);
    await insertJobs([
      job("gh-a-1", { postedAt: earlier }),
      job("lv-a-1", { source: "lever" }),
      job("gh-a-2", { title: "Data Analyst" }),
    ]);

    expect(await dedupeCrossSourceJobs()).toBe(1);
    const { jobs } = await searchJobsWithCount({});
    expect(jobs.map((j) => j.id).sort()).toEqual(["gh-a-1", "gh-a-2"]);
  });
});

describe("filter facets against D1", () => {
  it("offers only options that lead to fresh jobs", async () => {
    await insertJobs([job("gh-a-1"), job("gh-a-2", { department: "design" })]);

    const facets = await getFacetOptions();
    expect(facets.companies).toEqual([{ value: listedCompany, count: 2 }]);
    expect(facets.departments.map((d) => d.value).sort()).toEqual(["design", "engineering"]);
    expect(facets.countries).toEqual([
      { value: "germany", count: 2, cities: [{ value: "berlin", count: 2 }] },
    ]);
  });

  it("counts a multi-office posting once per country and once per city", async () => {
    await insertJobs([
      job("gh-a-1", { location: "berlin, germany", locations: ["Berlin", "Munich"] }),
    ]);

    const [germany] = (await getFacetOptions()).countries;
    expect(germany?.count).toBe(1);
    expect(germany?.cities.map((c) => [c.value, c.count]).sort()).toEqual([
      ["berlin", 1],
      ["munich", 1],
    ]);
  });
});
