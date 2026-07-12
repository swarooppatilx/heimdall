import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, count, desc, eq, gte, inArray, like, lt, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { crawls, jobs } from "../db/schema";
import { detectExperienceLevel } from "./experience";
import { freshnessCutoff } from "./freshness";
import { resolvePlace } from "./gazetteer";
import type { Job } from "./job";

type Db = ReturnType<typeof drizzle>;

let _db: Promise<Db> | null = null;

function getDb(): Promise<Db> {
  if (!_db) {
    _db = (async () => {
      const { env } = await getCloudflareContext();
      return drizzle(env.DB);
    })();
  }
  return _db;
}

export function bindDb(database: D1Database): void {
  _db = Promise.resolve(drizzle(database));
}

function toJob(row: typeof jobs.$inferSelect): Job {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    department: row.department,
    url: row.url,
    postedAt: new Date(row.postedAt),
    source: row.source,
    employmentType: row.employmentType,
    salary: row.salary,
    locations: JSON.parse(row.locations) as string[],
    region: row.region,
    isEarlyCareer: row.isEarlyCareer === 1,
    experienceLevel: row.experienceLevel,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
  };
}

export interface JobFilters {
  q?: string;
  company?: string;
  location?: string;
  source?: string;
  experience?: string;
  posted?: string;
  department?: string;
  employmentType?: string;
  earlyCareer?: string;
  sort?: string;
}

const POSTED_WINDOWS_MS: Record<string, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

export type JobSort = "newest" | "company";

export interface PageOptions {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function jobConditions(filters: JobFilters) {
  const conditions = [gte(jobs.postedAt, freshnessCutoff())];

  if (filters.q) {
    const needle = `%${filters.q.toLowerCase()}%`;
    const matchesAnyColumn = or(
      like(jobs.title, needle),
      like(jobs.company, needle),
      like(jobs.location, needle),
      like(jobs.department, needle),
      like(jobs.city, needle),
      like(jobs.country, needle),
    );
    if (matchesAnyColumn) {
      conditions.push(matchesAnyColumn);
    }
  }
  if (filters.company) {
    conditions.push(eq(jobs.company, filters.company));
  }
  if (filters.location) {
    const place = resolvePlace(filters.location);
    if (place?.remote) {
      conditions.push(eq(jobs.location, "Remote"));
    } else if (place?.city) {
      conditions.push(eq(jobs.city, place.city));
      if (place.country) {
        conditions.push(eq(jobs.country, place.country));
      }
    } else if (place?.country) {
      conditions.push(eq(jobs.country, place.country));
    } else {
      conditions.push(like(jobs.location, `%${filters.location}%`));
    }
  }
  if (filters.source) {
    conditions.push(eq(jobs.source, filters.source));
  }
  if (filters.experience) {
    conditions.push(eq(jobs.experienceLevel, filters.experience));
  }
  if (filters.department) {
    conditions.push(eq(jobs.department, filters.department));
  }
  if (filters.employmentType) {
    conditions.push(eq(jobs.employmentType, filters.employmentType));
  }
  if (filters.earlyCareer === "true") {
    conditions.push(eq(jobs.isEarlyCareer, 1));
  }
  const windowMs = filters.posted ? POSTED_WINDOWS_MS[filters.posted] : undefined;
  if (windowMs) {
    conditions.push(gte(jobs.postedAt, new Date(Date.now() - windowMs).toISOString()));
  }
  return conditions;
}

export async function countJobs(filters: JobFilters): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ value: count() })
    .from(jobs)
    .where(and(...jobConditions(filters)));
  return row?.value ?? 0;
}

export async function searchJobs(filters: JobFilters, page?: PageOptions): Promise<Job[]> {
  const db = await getDb();

  const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(page?.offset ?? 0, 0);

  const orderBy =
    filters.sort === "company" ? [asc(jobs.company), desc(jobs.postedAt)] : [desc(jobs.postedAt)];

  const rows = await db
    .select()
    .from(jobs)
    .where(and(...jobConditions(filters)))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);
  return rows.map(toJob);
}

const CHUNK_SIZE = 100;

function chunk<T>(items: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    pages.push(items.slice(i, i + CHUNK_SIZE));
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
    employmentType: (job.employmentType ?? "").trim(),
    salary: job.salary ?? "",
    locations: JSON.stringify(job.locations ?? [job.location]),
    region: job.region ?? "",
    isEarlyCareer: job.isEarlyCareer ? 1 : 0,
    experienceLevel: job.experienceLevel ?? detectExperienceLevel(job.title),
    city: job.city ?? null,
    country: job.country ?? null,
  };
}

export async function getJobsByIds(ids: string[]): Promise<Job[]> {
  const db = await getDb();
  const rows: (typeof jobs.$inferSelect)[] = [];
  for (const page of chunk(ids)) {
    const result = await db.select().from(jobs).where(inArray(jobs.id, page));
    rows.push(...result);
  }
  return rows.map(toJob);
}

export async function insertJobs(items: Job[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  for (const page of chunk(items)) {
    const statements = page.map((job) => {
      const values = toRow(job);
      return db
        .insert(jobs)
        .values(values)
        .onConflictDoUpdate({
          target: jobs.id,
          set: {
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
          },
        });
    });
    await db.batch(statements as never);
  }
}

export async function updateJobs(items: Job[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  for (const page of chunk(items)) {
    const statements = page.map((job) => {
      const values = toRow(job);
      return db
        .update(jobs)
        .set({
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
        })
        .where(eq(jobs.id, job.id));
    });
    await db.batch(statements as never);
  }
}

export async function getStaleNormJobs(version: number, limit: number): Promise<Job[]> {
  const db = await getDb();
  const rows = await db.select().from(jobs).where(lt(jobs.normVersion, version)).limit(limit);
  return rows.map(toJob);
}

export async function saveRenormalized(items: Job[], version: number): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  for (const page of chunk(items)) {
    const statements = page.map((job) => {
      const values = toRow(job);
      return db
        .update(jobs)
        .set({
          location: values.location,
          department: values.department,
          employmentType: values.employmentType,
          region: values.region,
          isEarlyCareer: values.isEarlyCareer,
          experienceLevel: values.experienceLevel,
          city: values.city,
          country: values.country,
          normVersion: version,
        })
        .where(eq(jobs.id, job.id));
    });
    await db.batch(statements as never);
  }
}

export async function deleteJobsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const page of chunk(ids)) {
    await db.delete(jobs).where(inArray(jobs.id, page));
  }
}

export async function getFilterOptions(): Promise<{
  companies: string[];
  locations: string[];
  sources: string[];
  departments: string[];
  employmentTypes: string[];
}> {
  const db = await getDb();

  const companies = await db
    .selectDistinct({ value: jobs.company })
    .from(jobs)
    .where(ne(jobs.company, ""))
    .orderBy(asc(jobs.company));
  const locations = await db
    .selectDistinct({ value: jobs.location })
    .from(jobs)
    .where(and(ne(jobs.location, ""), ne(jobs.location, "unknown")))
    .orderBy(asc(jobs.location));
  const sources = await db
    .selectDistinct({ value: jobs.source })
    .from(jobs)
    .where(ne(jobs.source, ""))
    .orderBy(asc(jobs.source));
  const departments = await db
    .selectDistinct({ value: jobs.department })
    .from(jobs)
    .where(ne(jobs.department, ""))
    .orderBy(asc(jobs.department));
  const employmentTypes = await db
    .selectDistinct({ value: jobs.employmentType })
    .from(jobs)
    .where(ne(jobs.employmentType, ""))
    .orderBy(asc(jobs.employmentType));
  return {
    companies: companies.map((r) => r.value),
    locations: locations.map((r) => r.value),
    sources: sources.map((r) => r.value),
    departments: departments.map((r) => r.value),
    employmentTypes: employmentTypes.map((r) => r.value),
  };
}

export async function getJobsByCompany(company: string): Promise<Job[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.company, company), gte(jobs.postedAt, freshnessCutoff())))
    .orderBy(desc(jobs.postedAt));
  return rows.map(toJob);
}

export async function getCompanyStats(company: string): Promise<{
  total: number;
  departments: string[];
  locations: string[];
  sources: string[];
}> {
  const db = await getDb();
  const scope = and(eq(jobs.company, company), gte(jobs.postedAt, freshnessCutoff()));

  const [totalRows, departments, locations, sources] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(jobs).where(scope),
    db
      .selectDistinct({ value: jobs.department })
      .from(jobs)
      .where(scope)
      .orderBy(asc(jobs.department)),
    db.selectDistinct({ value: jobs.location }).from(jobs).where(scope).orderBy(asc(jobs.location)),
    db.selectDistinct({ value: jobs.source }).from(jobs).where(scope).orderBy(asc(jobs.source)),
  ]);

  return {
    total: Number(totalRows[0]?.count ?? 0),
    departments: departments.map((r) => r.value),
    locations: locations.map((r) => r.value),
    sources: sources.map((r) => r.value),
  };
}

export async function getJobCount(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(gte(jobs.postedAt, freshnessCutoff()));
  return Number(rows[0]?.count ?? 0);
}

export async function getJobQuality(): Promise<{
  total: number;
  distinctLocations: number;
  unknownLocationShare: number;
  generalDepartmentShare: number;
}> {
  const db = await getDb();
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      distinctLocations: sql<number>`count(distinct ${jobs.location})`,
      unknownLocationShare: sql<number>`avg(case when ${jobs.location} = 'unknown' then 1.0 else 0 end)`,
      generalDepartmentShare: sql<number>`avg(case when ${jobs.department} = 'general' then 1.0 else 0 end)`,
    })
    .from(jobs);
  return {
    total: Number(row?.total ?? 0),
    distinctLocations: Number(row?.distinctLocations ?? 0),
    unknownLocationShare: Number(row?.unknownLocationShare ?? 0),
    generalDepartmentShare: Number(row?.generalDepartmentShare ?? 0),
  };
}

export async function deleteStaleJobs(): Promise<number> {
  const db = await getDb();
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

export async function recordCrawl(
  company: string,
  status: string,
  jobsFound: number,
  durationMs: number,
  error?: string,
): Promise<void> {
  const db = await getDb();
  await db.insert(crawls).values({
    company,
    status,
    jobsFound,
    durationMs,
    error: error ?? null,
  });
}

export async function getLatestCrawlUnix(): Promise<number | null> {
  const db = await getDb();
  const [row] = await db
    .select({ latest: sql<string | null>`strftime('%s', max(${crawls.createdAt}))` })
    .from(crawls);
  const latest = row?.latest;
  return latest ? Number(latest) * 1000 : null;
}

export interface CrawlRecord {
  company: string;
  status: string;
  jobsFound: number;
  durationMs: number;
  error: string | null;
  createdAt: string;
}

function toCrawlRecord(row: typeof crawls.$inferSelect): CrawlRecord {
  return {
    company: row.company,
    status: row.status,
    jobsFound: row.jobsFound,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: row.createdAt,
  };
}

export async function getCrawlHistory(): Promise<CrawlRecord[]> {
  const db = await getDb();
  const rows = await db.select().from(crawls).orderBy(desc(crawls.createdAt)).limit(100);
  return rows.map(toCrawlRecord);
}

export async function getLatestCrawls(): Promise<CrawlRecord[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(crawls)
    .where(sql`id IN (SELECT MAX(id) FROM ${crawls} GROUP BY company)`)
    .orderBy(desc(crawls.createdAt));
  return rows.map(toCrawlRecord);
}

export interface CrawlSample {
  company: string;
  status: string;
  jobsFound: number;
}

export async function getRecentCrawlSamples(hours: number): Promise<CrawlSample[]> {
  const db = await getDb();
  const rows = await db
    .select({
      company: crawls.company,
      status: crawls.status,
      jobsFound: crawls.jobsFound,
    })
    .from(crawls)
    .where(sql`${crawls.createdAt} >= datetime('now', ${`-${hours} hours`})`)
    .orderBy(desc(crawls.id));
  return rows;
}
