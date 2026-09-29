import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Job } from "@/lib/job";
import { bindDb } from "@/server/db";
import { jobIdMatch } from "@/server/jobs/fts";
import { deleteJobsByIds, deleteStaleJobs, insertJobs, updateJobs } from "@/server/jobs/writes";
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

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    title: "Platform Engineer",
    company: "acme",
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

async function count(sql: string): Promise<number> {
  const row = await db.prepare(sql).first<{ n: number }>();
  return row?.n ?? 0;
}

async function searchIds(query: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT job_id FROM jobs_fts WHERE jobs_fts MATCH ? ORDER BY job_id")
    .bind(query)
    .all<{ job_id: string }>();
  return results.map((row) => row.job_id);
}

describe("job writes against D1", () => {
  it("indexes inserted jobs for search in the same write", async () => {
    await insertJobs([job("gh-acme-1"), job("gh-acme-2", { title: "Data Analyst" })]);

    expect(await count("SELECT count(*) AS n FROM jobs")).toBe(2);
    expect(await searchIds('"platform"*')).toEqual(["gh-acme-1"]);
    expect(await count("SELECT count(*) AS n FROM job_locations")).toBe(2);
  });

  it("keeps ids with quotes intact as bound parameters", async () => {
    await insertJobs([job("lv-acme-o'brien")]);
    await deleteJobsByIds(["lv-acme-o'brien"]);

    expect(await count("SELECT count(*) AS n FROM jobs")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM jobs_fts")).toBe(0);
  });

  it("reindexes a retitled job instead of leaving the old title searchable", async () => {
    await insertJobs([job("gh-acme-1")]);
    await updateJobs([
      {
        job: job("gh-acme-1", { title: "Staff Engineer" }),
        changed: { core: true, location: false },
      },
    ]);

    expect(await searchIds('"platform"*')).toEqual([]);
    expect(await searchIds('"staff"*')).toEqual(["gh-acme-1"]);
    expect(await count("SELECT count(*) AS n FROM jobs_fts")).toBe(1);
  });

  it("removes jobs, facets and search rows together in pages under the parameter limit", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `gh-acme-${i}`);
    await insertJobs(ids.map((id) => job(id)));
    await deleteJobsByIds(ids);

    expect(await count("SELECT count(*) AS n FROM jobs")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM job_locations")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM jobs_fts")).toBe(0);
  });

  it("rolls back the whole page when one statement fails, so search never drifts", async () => {
    await expect(
      insertJobs([job("gh-acme-1"), job("gh-acme-2", { title: null as unknown as string })]),
    ).rejects.toThrow();

    expect(await count("SELECT count(*) AS n FROM jobs")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM jobs_fts")).toBe(0);
  });
  it("sweeps expired jobs out of every table", async () => {
    const expired = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    await insertJobs([job("gh-acme-old", { postedAt: expired }), job("gh-acme-new")]);

    expect(await deleteStaleJobs()).toBe(1);
    expect(await searchIds('"platform"*')).toEqual(["gh-acme-new"]);
  });
});

describe("write costs against D1", () => {
  it("reports one budget unit per D1 batch it actually sends", async () => {
    let batches = 0;
    const counting = {
      prepare: (query: string) => db.prepare(query),
      batch: (statements: D1PreparedStatement[]) => {
        batches += 1;
        return db.batch(statements);
      },
    } as unknown as D1Database;
    bindDb(counting);
    const ids = Array.from({ length: 100 }, (_, i) => `gh-acme-${i}`);

    try {
      expect(await insertJobs(ids.map((id) => job(id)))).toBe(5);
      expect(batches).toBe(5);
      expect(await deleteJobsByIds(ids)).toBe(2);
      expect(batches).toBe(7);
    } finally {
      bindDb(db);
    }
  });

  it("finds a job's search row through the index instead of scanning", async () => {
    await db
      .prepare(
        `INSERT INTO jobs_fts (title, company, location, department, job_id)
         WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 499)
         SELECT 'Platform Engineer', 'acme', 'berlin', 'engineering', 'gh-acme-' || i FROM n`,
      )
      .run();
    const target = "gh-acme-250";

    const scan = await db
      .prepare("SELECT count(*) AS n FROM jobs_fts WHERE job_id IN (?)")
      .bind(target)
      .run();
    const indexed = await db
      .prepare(
        "SELECT count(*) AS n FROM jobs_fts WHERE rowid IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?) AND job_id IN (?)",
      )
      .bind(jobIdMatch([target]), target)
      .run();

    expect(indexed.results).toEqual([{ n: 1 }]);
    expect(scan.meta.rows_read).toBeGreaterThanOrEqual(500);
    expect(indexed.meta.rows_read).toBeLessThan(scan.meta.rows_read / 10);
  });
});
