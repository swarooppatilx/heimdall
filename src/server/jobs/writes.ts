import { eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Job } from "@/lib/job";
import { resolvePlace } from "@/modules/crawl/gazetteer";
import type { Db } from "@/server/db";
import { getDb } from "@/server/db";
import { jobLocations, jobs } from "@/server/db/schema";
import { freshnessCutoff } from "@/server/jobs/freshness";

const BATCH_LIMIT = 100;

function chunkStatements<T>(jobs: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < jobs.length; i += BATCH_LIMIT) {
    pages.push(jobs.slice(i, i + BATCH_LIMIT));
  }
  return pages;
}

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
    region: job.region ?? "",
    isEarlyCareer: job.isEarlyCareer ? 1 : 0,
    experienceLevel: job.experienceLevel,
    city: job.city ?? null,
    country: job.country ?? null,
    isRemote: job.isRemote ? 1 : 0,
  };
}

interface LocationFacet {
  city: string;
  country: string;
}

function locationFacets(job: Job): LocationFacet[] {
  const raw = [job.location, ...(job.locations ?? [])];
  const seen = new Set<string>();
  const facets: LocationFacet[] = [];
  for (const entry of raw) {
    const place = resolvePlace(entry);
    if (!(place?.city && place.country)) continue;
    const key = `${place.city}|${place.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facets.push({ city: place.city, country: place.country });
  }
  return facets;
}

function facetStatements(db: Db, job: Job): BatchItem<"sqlite">[] {
  const clear = db.delete(jobLocations).where(eq(jobLocations.jobId, job.id));
  const facets = locationFacets(job);
  if (facets.length === 0) return [clear];
  const inserts = db
    .insert(jobLocations)
    .values(facets.map((facet) => ({ jobId: job.id, ...facet })));
  return [clear, inserts];
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
    region: values.region,
    isEarlyCareer: values.isEarlyCareer,
    experienceLevel: values.experienceLevel,
    city: values.city,
    country: values.country,
    isRemote: values.isRemote,
  };
}

function jobStatements(db: Db, job: Job, mode: "insert" | "update"): BatchItem<"sqlite">[] {
  const values = toRow(job);
  const setFields = jobUpsertSet(values);
  const jobStatement =
    mode === "insert"
      ? db.insert(jobs).values(values).onConflictDoUpdate({ target: jobs.id, set: setFields })
      : db.update(jobs).set(setFields).where(eq(jobs.id, job.id));
  return [jobStatement, ...facetStatements(db, job)];
}

async function writeJobs(jobs: Job[], mode: "insert" | "update"): Promise<void> {
  if (jobs.length === 0) return;
  const db = await getDb();
  const allStatements = jobs.flatMap((job) => jobStatements(db, job, mode));
  for (const page of chunkStatements(allStatements)) {
    await db.batch(page as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
}

/** Inserts new jobs into D1, skipping conflicts on existing IDs. */
export async function insertJobs(jobs: Job[]): Promise<void> {
  await writeJobs(jobs, "insert");
}

/** Updates existing jobs in D1 by ID. */
export async function updateJobs(jobs: Job[]): Promise<void> {
  await writeJobs(jobs, "update");
}

/** Deletes jobs and their location facets by ID. */
export async function deleteJobsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const page of chunkStatements(ids)) {
    await db.batch([
      db.delete(jobs).where(inArray(jobs.id, page)),
      db.delete(jobLocations).where(inArray(jobLocations.jobId, page)),
    ]);
  }
}

/** Deletes jobs older than the freshness cutoff. Returns the count of deleted jobs. */
export async function deleteStaleJobs(): Promise<number> {
  const db = await getDb();
  const stale = await db.all<{ id: string }>(
    sql`SELECT id FROM jobs WHERE posted_at < ${freshnessCutoff()}`,
  );
  if (stale.length === 0) return 0;
  const ids = stale.map((row) => row.id);
  await deleteJobsByIds(ids);
  return ids.length;
}

/** Removes duplicate jobs that appear across multiple sources, keeping the earliest. */
export async function dedupeCrossSourceJobs(): Promise<number> {
  const db = await getDb();
  const cutoff = freshnessCutoff();
  const rows = await db.all<{ id: string }>(sql`
    SELECT id FROM jobs WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY company, title, city
            ORDER BY posted_at ASC, source ASC, id ASC
          ) AS rn,
          min(source) OVER (PARTITION BY company, title, city) AS lo,
          max(source) OVER (PARTITION BY company, title, city) AS hi
        FROM jobs
        WHERE city IS NOT NULL AND country IS NOT NULL AND posted_at >= ${cutoff}
      )
      WHERE rn > 1 AND lo != hi
    )
  `);
  const ids = rows.map((row) => String(row.id));
  if (ids.length === 0) return 0;
  await deleteJobsByIds(ids);
  return ids.length;
}
