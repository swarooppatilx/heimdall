import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, desc, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { crawls, jobs } from "../db/schema";
import { detectExperienceLevel } from "./experience";
import { freshnessCutoff } from "./freshness";
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
    experienceLevel: row.experienceLevel,
  };
}

export interface JobFilters {
  q?: string;
  company?: string;
  location?: string;
  source?: string;
  type?: string;
  experience?: string;
  posted?: string;
}

const POSTED_WINDOWS_MS: Record<string, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
};

export interface PageOptions {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function searchJobs(filters: JobFilters, page?: PageOptions): Promise<Job[]> {
  const db = await getDb();

  const conditions = [gte(jobs.postedAt, freshnessCutoff())];

  if (filters.q) {
    const needle = `%${filters.q}%`;
    const matchesAnyColumn = or(
      like(jobs.title, needle),
      like(jobs.company, needle),
      like(jobs.location, needle),
      like(jobs.department, needle),
    );
    if (matchesAnyColumn) {
      conditions.push(matchesAnyColumn);
    }
  }
  if (filters.company) {
    conditions.push(eq(jobs.company, filters.company));
  }
  if (filters.location) {
    conditions.push(like(jobs.location, `%${filters.location}%`));
  }
  if (filters.source) {
    conditions.push(eq(jobs.source, filters.source));
  }
  if (filters.type === "remote") {
    conditions.push(like(jobs.location, "%remote%"));
  }
  if (filters.experience) {
    conditions.push(eq(jobs.experienceLevel, filters.experience));
  }
  const windowMs = filters.posted ? POSTED_WINDOWS_MS[filters.posted] : undefined;
  if (windowMs) {
    conditions.push(gte(jobs.postedAt, new Date(Date.now() - windowMs).toISOString()));
  }

  const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(page?.offset ?? 0, 0);

  const rows = await db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.postedAt))
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
    department: job.department,
    url: job.url,
    postedAt: job.postedAt.toISOString(),
    source: job.source,
    experienceLevel: detectExperienceLevel(job.title),
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
    const statements = page.map((job) =>
      db.insert(jobs).values(toRow(job)).onConflictDoNothing({ target: jobs.id }),
    );
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
          experienceLevel: values.experienceLevel,
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
}> {
  const db = await getDb();
  const fresh = gte(jobs.postedAt, freshnessCutoff());

  const companies = await db
    .selectDistinct({ value: jobs.company })
    .from(jobs)
    .where(fresh)
    .orderBy(asc(jobs.company));
  const locations = await db
    .selectDistinct({ value: jobs.location })
    .from(jobs)
    .where(fresh)
    .orderBy(asc(jobs.location));
  const sources = await db
    .selectDistinct({ value: jobs.source })
    .from(jobs)
    .where(fresh)
    .orderBy(asc(jobs.source));

  return {
    companies: companies.map((r) => r.value),
    locations: locations.map((r) => r.value),
    sources: sources.map((r) => r.value),
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

  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(scope);
  const departments = await db
    .selectDistinct({ value: jobs.department })
    .from(jobs)
    .where(scope)
    .orderBy(asc(jobs.department));
  const locations = await db
    .selectDistinct({ value: jobs.location })
    .from(jobs)
    .where(scope)
    .orderBy(asc(jobs.location));
  const sources = await db
    .selectDistinct({ value: jobs.source })
    .from(jobs)
    .where(scope)
    .orderBy(asc(jobs.source));

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

export async function deleteStaleJobs(): Promise<number> {
  const db = await getDb();
  const result = await db.delete(jobs).where(lt(jobs.postedAt, freshnessCutoff()));
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

interface CrawlRecord {
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
    .where(sql`id IN (SELECT MAX(id) FROM ${crawls} GROUP BY company)`);
  return rows.map(toCrawlRecord);
}
