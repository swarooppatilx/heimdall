import { eq, inArray, lt, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { jobLocations, jobs } from "@/db/schema";
import type { Db } from "@/lib/db-connection";
import { chunk, getDb } from "@/lib/db-connection";
import { freshnessCutoff } from "@/lib/freshness";
import { resolvePlace } from "@/lib/gazetteer";
import type { Job } from "@/lib/job";

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
    employmentType: (job.employmentType ?? "").trim(),
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

function ftsStatements(db: Db, job: Job): BatchItem<"sqlite">[] {
  const clear = db.run(sql`DELETE FROM jobs_fts WHERE job_id = ${job.id}`);
  const insert = db.run(
    sql`INSERT INTO jobs_fts (title, company, location, department, job_id)
        VALUES (${job.title}, ${job.company}, ${job.location}, ${job.department.trim()}, ${job.id})`,
  );
  return [clear, insert];
}

export function locationFacets(job: Job): LocationFacet[] {
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
    employmentType: values.employmentType,
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

export async function insertJobs(items: Job[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  for (const page of chunk(items)) {
    const statements: BatchItem<"sqlite">[] = [];
    for (const job of page) {
      const values = toRow(job);
      statements.push(
        db
          .insert(jobs)
          .values(values)
          .onConflictDoUpdate({
            target: jobs.id,
            set: {
              ...jobUpsertSet(values),
            },
          }),
      );
      statements.push(...facetStatements(db, job));
      statements.push(...ftsStatements(db, job));
    }
    await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
}

export async function updateJobs(items: Job[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  for (const page of chunk(items)) {
    const statements: BatchItem<"sqlite">[] = [];
    for (const job of page) {
      const values = toRow(job);
      statements.push(
        db
          .update(jobs)
          .set({
            ...jobUpsertSet(values),
          })
          .where(eq(jobs.id, job.id)),
      );
      statements.push(...facetStatements(db, job));
      statements.push(...ftsStatements(db, job));
    }
    await db.batch(statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
}

export async function deleteJobsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const page of chunk(ids)) {
    await db.batch([
      db.delete(jobs).where(inArray(jobs.id, page)),
      db.delete(jobLocations).where(inArray(jobLocations.jobId, page)),
      db.run(
        sql`DELETE FROM jobs_fts WHERE job_id IN (${sql.join(page.map((id) => sql`${id}`, sql`, `))})`,
      ),
    ]);
  }
}

export async function deleteStaleJobs(): Promise<number> {
  const db = await getDb();
  await db.run(
    sql`DELETE FROM jobs_fts WHERE job_id IN (SELECT id FROM jobs WHERE posted_at < ${freshnessCutoff()})`,
  );
  const result = await db.delete(jobs).where(lt(jobs.postedAt, freshnessCutoff()));
  return result.meta.changes ?? 0;
}

export async function dedupeCrossSourceJobs(): Promise<number> {
  const db = await getDb();
  const cutoff = freshnessCutoff();
  const result = await db.run(sql`
    DELETE FROM jobs WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY company, lower(title), city
            ORDER BY posted_at ASC, source ASC, id ASC
          ) AS rn,
          min(source) OVER (PARTITION BY company, lower(title), city) AS lo,
          max(source) OVER (PARTITION BY company, lower(title), city) AS hi
        FROM jobs
        WHERE city IS NOT NULL AND country IS NOT NULL AND posted_at >= ${cutoff}
      )
      WHERE rn > 1 AND lo != hi
    )
  `);
  return result.meta.changes ?? 0;
}
