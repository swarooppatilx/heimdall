import { eq, inArray, type Query, type SQL, sql } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { chunk } from "@/lib/chunk";
import type { Job } from "@/lib/job";
import type { ChangedFields } from "@/server/crawl/diff";
import { type Db, getDb } from "@/server/db";
import { jobLocations, jobs } from "@/server/db/schema";
import { freshnessCutoff } from "@/server/jobs/freshness";
import { jobIdMatch } from "@/server/jobs/fts";
import { resolvePlace } from "@/server/locations/gazetteer";
import { logEvent } from "@/server/logger";

// D1 rejects a statement once it reaches 100 bound parameters, so id lists
// stay below that.
const ID_PAGE_SIZE = 90;
const FACET_ROWS_PER_INSERT = 30;
// Each D1 batch runs as one transaction. Writing a page of jobs, their
// location facets and their search rows together means a failure can never
// leave jobs_fts missing a job or pointing at a deleted one.
const JOBS_PER_BATCH = 20;
const DELETE_BATCH_LIMIT = 500;
// Bounds the D1 queries one cron tick spends on cleanup (~7 per round); a
// larger backlog carries over to the next sweep.
const CLEANUP_ROUNDS_PER_TICK = 3;

// Queries are built with Drizzle but sent through D1's own batch, because
// Drizzle's batch can't carry raw SQL (drizzle issue #2277) and the jobs_fts
// statements are raw.
const dialect = new SQLiteAsyncDialect();
type Statement = Query;

function toRow(job: Job): typeof jobs.$inferInsert {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    department: job.department.trim(),
    url: job.url,
    postedAt: job.postedAt.toISOString(),
    source: job.source,
    salary: job.salary ?? "",
    locations: JSON.stringify(job.locations ?? [job.location]),
    level: job.level,
    city: job.city ?? null,
    country: job.country ?? null,
    isRemote: job.isRemote ? 1 : 0,
  };
}

function idList(ids: string[]): SQL {
  return sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
}

// The MATCH finds rows through the job_id index; the IN check keeps the delete
// exact, since a phrase match compares tokens rather than whole ids.
function ftsDelete(ids: string[]): Statement {
  return dialect.sqlToQuery(sql`
    DELETE FROM jobs_fts
    WHERE rowid IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ${jobIdMatch(ids)})
      AND job_id IN (${idList(ids)})
  `);
}

function ftsInsert(ids: string[]): Statement {
  return dialect.sqlToQuery(sql`
    INSERT INTO jobs_fts (title, company, location, department, job_id)
    SELECT title, company, location, department, id FROM jobs WHERE id IN (${idList(ids)})
  `);
}

async function runBatch(db: Db, statements: Statement[]): Promise<void> {
  if (statements.length === 0) return;
  const d1 = db.$client;
  await d1.batch(statements.map(({ sql: text, params }) => d1.prepare(text).bind(...params)));
}

// Country-only places ("germany", "remote, germany") get a row with an empty
// city, so a country filter finds them as well as city-level jobs.
function locationFacets(job: Job): { city: string; country: string }[] {
  const seen = new Set<string>();
  const facets: { city: string; country: string }[] = [];
  for (const entry of [job.location, ...(job.locations ?? [])]) {
    const place = resolvePlace(entry);
    if (!place?.country) continue;
    const city = place.remote ? "" : (place.city ?? "");
    const key = `${city}|${place.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facets.push({ city, country: place.country });
  }
  return facets;
}

function facetStatements(db: Db, job: Job): Statement[] {
  const clear = db.delete(jobLocations).where(eq(jobLocations.jobId, job.id)).toSQL();
  const inserts = chunk(locationFacets(job), FACET_ROWS_PER_INSERT).map((page) =>
    db
      .insert(jobLocations)
      .values(page.map((facet) => ({ jobId: job.id, ...facet })))
      .toSQL(),
  );
  return [clear, ...inserts];
}

function jobUpsertSet(values: typeof jobs.$inferInsert) {
  return {
    title: values.title,
    location: values.location,
    department: values.department,
    url: values.url,
    postedAt: values.postedAt,
    salary: values.salary,
    locations: values.locations,
    level: values.level,
    city: values.city,
    country: values.country,
    isRemote: values.isRemote,
  };
}

function jobStatements(db: Db, job: Job, changed?: ChangedFields): Statement[] {
  const values = toRow(job);
  const set = jobUpsertSet(values);
  if (!changed) {
    const upsert = db
      .insert(jobs)
      .values(values)
      .onConflictDoUpdate({ target: jobs.id, set })
      .toSQL();
    return [upsert, ...facetStatements(db, job)];
  }
  const update = db.update(jobs).set(set).where(eq(jobs.id, job.id)).toSQL();
  return changed.location ? [update, ...facetStatements(db, job)] : [update];
}

/** Returns the number of D1 batches run, for the caller's subrequest budget. */
async function writeJobs(entries: Array<{ job: Job; changed?: ChangedFields }>): Promise<number> {
  if (entries.length === 0) return 0;
  const db = await getDb();
  const pages = chunk(entries, JOBS_PER_BATCH);
  for (const page of pages) {
    const ids = page.map(({ job }) => job.id);
    await runBatch(db, [
      ...page.flatMap(({ job, changed }) => jobStatements(db, job, changed)),
      ftsDelete(ids),
      ftsInsert(ids),
    ]);
  }
  return pages.length;
}

// Upserts, so a job that was inserted by a concurrent crawl is updated rather than rejected.
export function insertJobs(jobs: Job[]): Promise<number> {
  return writeJobs(jobs.map((job) => ({ job })));
}

// Location facets are only rewritten for jobs whose location changed.
export function updateJobs(updates: Array<{ job: Job; changed: ChangedFields }>): Promise<number> {
  return writeJobs(updates);
}

/** Returns the number of D1 batches run, for the caller's subrequest budget. */
export async function deleteJobsByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  const pages = chunk(ids, ID_PAGE_SIZE);
  for (const page of pages) {
    await runBatch(db, [
      db.delete(jobs).where(inArray(jobs.id, page)).toSQL(),
      db.delete(jobLocations).where(inArray(jobLocations.jobId, page)).toSQL(),
      ftsDelete(page),
    ]);
  }
  return pages.length;
}

async function deleteInRounds(name: string, selectIds: (db: Db) => Promise<string[]>) {
  const db = await getDb();
  let deleted = 0;
  for (let round = 0; round < CLEANUP_ROUNDS_PER_TICK; round += 1) {
    const ids = await selectIds(db);
    await deleteJobsByIds(ids);
    deleted += ids.length;
    if (ids.length < DELETE_BATCH_LIMIT) return deleted;
  }
  logEvent("cleanup_deferred", { task: name, deleted });
  return deleted;
}

export function deleteStaleJobs(): Promise<number> {
  const cutoff = freshnessCutoff();
  return deleteInRounds("stale", async (db) => {
    const rows = await db.all<{ id: string }>(
      sql`SELECT id FROM jobs WHERE posted_at < ${cutoff} LIMIT ${DELETE_BATCH_LIMIT}`,
    );
    return rows.map((row) => row.id);
  });
}

// The same role listed on several sources keeps only its earliest posting.
export function dedupeCrossSourceJobs(): Promise<number> {
  const cutoff = freshnessCutoff();
  return deleteInRounds("dedupe", async (db) => {
    const rows = await db.all<{ id: string }>(sql`
      WITH ranked AS (
        SELECT
          id,
          -- lower(title) matches dedupeKey's case rule; SQLite can't fold
          -- accents, but titles from different ATSes rarely differ only there.
          row_number() OVER (
            PARTITION BY company, lower(title), city
            ORDER BY posted_at ASC, source ASC, id ASC
          ) AS rn,
          min(source) OVER (PARTITION BY company, lower(title), city) AS lo,
          max(source) OVER (PARTITION BY company, lower(title), city) AS hi
        FROM jobs
        WHERE city IS NOT NULL AND country IS NOT NULL AND posted_at >= ${cutoff}
      )
      SELECT id FROM ranked WHERE rn > 1 AND lo != hi
      LIMIT ${DELETE_BATCH_LIMIT}
    `);
    return rows.map((row) => String(row.id));
  });
}
