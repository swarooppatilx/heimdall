import type { AnyColumn } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ne, sql } from "drizzle-orm";
import { jobLocations, jobs } from "@/db/schema";
import { getDb } from "@/lib/db-connection";
import { DAY_MS, freshnessCutoff } from "@/lib/freshness";
import { resolvePlace } from "@/lib/gazetteer";
import type { Job } from "@/lib/job";
import { sanitizeFilterValue } from "@/lib/sanitize";

function parseLocations(raw: string, fallback: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [fallback];
  }
}

function toJob(row: typeof jobs.$inferSelect): Job {
  return {
    id: row.id,
    title: row.title ?? "",
    company: row.company ?? "",
    location: row.location ?? "",
    department: row.department ?? "",
    url: row.url ?? "",
    postedAt: new Date(row.postedAt),
    source: row.source ?? "",
    salary: row.salary,
    locations: parseLocations(row.locations, row.location),
    region: row.region,
    isEarlyCareer: row.isEarlyCareer === 1,
    experienceLevel: row.experienceLevel,
    ...(row.city === null ? {} : { city: row.city }),
    ...(row.country === null ? {} : { country: row.country }),
    isRemote: row.isRemote === 1,
  };
}

export interface JobFilters {
  q?: string;
  company?: string;
  location?: string;
  city?: string;
  country?: string;
  source?: string;
  experience?: string;
  posted?: string;
  department?: string;
  earlyCareer?: string;
  sort?: string;
}

const DAYS_PER_WEEK = 7;
const POSTED_WINDOWS_MS: Record<string, number> = {
  today: DAY_MS,
  week: DAYS_PER_WEEK * DAY_MS,
};

export const POSTED_WINDOWS = Object.keys(POSTED_WINDOWS_MS);

export interface PageOptions {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function facetMatch(city: string | undefined, country: string | undefined) {
  const conds = [sql`${jobLocations.jobId} = ${jobs.id}`];
  if (city) {
    conds.push(sql`${jobLocations.city} = ${city.toLowerCase()}`);
  }
  if (country) {
    conds.push(sql`${jobLocations.country} = ${country.toLowerCase()}`);
  }
  return sql`exists (select 1 from ${jobLocations} where ${sql.join(conds, sql` and `)})`;
}

function eqJobCompany(value: string) {
  return sql`${jobs.company} = ${value}`;
}

function eqColumnLower(column: AnyColumn, value: string) {
  return sql`${column} = ${value}`;
}

function companyCondition(value: string | undefined) {
  if (!value) return undefined;
  return eqJobCompany(sanitizeFilterValue(value));
}

function locationCondition(value: string | undefined) {
  if (!value) return undefined;
  const place = resolvePlace(value);
  if (place?.remote) return eq(jobs.isRemote, 1);
  if (place?.city) return facetMatch(place.city, place.country);
  if (place?.country) return facetMatch(undefined, place.country);
  return sql`${jobs.location} LIKE ${`%${escapeLike(value)}%`} ESCAPE '\\'`;
}

function cityCountryCondition(city: string | undefined, country: string | undefined) {
  if (city) return facetMatch(city, country);
  if (country) return facetMatch(undefined, country);
  return undefined;
}

function columnCondition(column: AnyColumn, value: string | undefined) {
  if (!value) return undefined;
  return eqColumnLower(column, sanitizeFilterValue(value));
}

function postedCondition(value: string | undefined) {
  if (!value) return undefined;
  const windowMs = POSTED_WINDOWS_MS[value];
  if (!windowMs) return undefined;
  return gte(jobs.postedAt, new Date(Date.now() - windowMs).toISOString());
}

function jobConditions(filters: JobFilters) {
  const conditions = [
    gte(jobs.postedAt, freshnessCutoff()),
    companyCondition(filters.company),
    locationCondition(filters.location),
    cityCountryCondition(filters.city, filters.country),
    columnCondition(jobs.source, filters.source),
    columnCondition(jobs.experienceLevel, filters.experience),
    columnCondition(jobs.department, filters.department),
    filters.earlyCareer === "true" ? eq(jobs.isEarlyCareer, 1) : undefined,
    postedCondition(filters.posted),
  ];

  if (filters.q) {
    const escaped = escapeLike(filters.q);
    conditions.push(sql`${jobs.title} LIKE ${`%${escaped}%`} ESCAPE '\\'`);
  }

  return conditions.filter((c): c is NonNullable<typeof c> => c != null);
}

export interface SearchResult {
  jobs: Job[];
  total: number;
}

export async function searchJobsWithCount(
  filters: JobFilters,
  page?: PageOptions,
): Promise<SearchResult> {
  const db = await getDb();

  const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(page?.offset ?? 0, 0);

  const orderBy =
    filters.sort === "company" ? [asc(jobs.company), desc(jobs.postedAt)] : [desc(jobs.postedAt)];

  const conditions = and(...jobConditions(filters));

  const [jobRows, countResult] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(conditions)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(jobs).where(conditions),
  ]);

  return {
    jobs: jobRows.map(toJob),
    total: countResult[0]?.value ?? 0,
  };
}

export async function getJobsByBoard(source: string, company: string): Promise<Job[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(
        sql`${jobs.source} = ${source.toLowerCase()}`,
        sql`${jobs.company} = ${company.toLowerCase()}`,
      ),
    );
  return rows.map(toJob);
}

export async function getCompanyNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ value: jobs.company })
    .from(jobs)
    .where(and(ne(jobs.company, ""), gte(jobs.postedAt, freshnessCutoff())))
    .orderBy(asc(jobs.company));
  return rows.map((r) => r.value);
}

export async function getJobsByCompany(company: string): Promise<Job[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eqJobCompany(company), gte(jobs.postedAt, freshnessCutoff())))
    .orderBy(desc(jobs.postedAt));
  return rows.map(toJob);
}

export async function countJobsByCompany(company: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ value: count() })
    .from(jobs)
    .where(and(eqJobCompany(company), gte(jobs.postedAt, freshnessCutoff())));
  return row?.value ?? 0;
}

export async function getAllFreshJobs(): Promise<Job[]> {
  const db = await getDb();
  const rows = await db.select().from(jobs).where(gte(jobs.postedAt, freshnessCutoff()));
  return rows.map(toJob);
}

export async function getRecentJobs(limit: number): Promise<Job[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(gte(jobs.postedAt, freshnessCutoff()))
    .orderBy(desc(jobs.postedAt))
    .limit(limit);
  return rows.map(toJob);
}
