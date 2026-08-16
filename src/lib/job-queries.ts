import type { AnyColumn } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, ne, sql } from "drizzle-orm";
import { jobLocations, jobs } from "@/db/schema";
import { getDb } from "@/lib/db-connection";
import { resolveEmploymentType } from "@/lib/employment";
import { DAY_MS, freshnessCutoff } from "@/lib/freshness";
import { resolvePlace } from "@/lib/gazetteer";
import type { Job } from "@/lib/job";
import { sanitizeFilterValue } from "@/lib/sanitize";
import { buildMatchQuery } from "@/lib/search";

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
  employmentType?: string;
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

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function facetMatch(city: string | undefined, country: string | undefined) {
  const conds = [sql`${jobLocations.jobId} = ${jobs.id}`];
  if (city) {
    conds.push(sql`lower(${jobLocations.city}) = ${city.toLowerCase()}`);
  }
  if (country) {
    conds.push(sql`lower(${jobLocations.country}) = ${country.toLowerCase()}`);
  }
  return sql`exists (select 1 from ${jobLocations} where ${sql.join(conds, sql` and `)})`;
}

function eqJobCompany(value: string) {
  return sql`lower(${jobs.company}) = lower(${value})`;
}

function eqColumnLower(column: AnyColumn, value: string) {
  return sql`lower(${column}) = lower(${value})`;
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

function employmentTypeCondition(value: string | undefined) {
  if (!value) return undefined;
  const resolved = resolveEmploymentType(sanitizeFilterValue(value));
  return eqColumnLower(jobs.employmentType, resolved ?? sanitizeFilterValue(value));
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
    employmentTypeCondition(filters.employmentType),
    filters.earlyCareer === "true" ? eq(jobs.isEarlyCareer, 1) : undefined,
    postedCondition(filters.posted),
  ];

  if (filters.q) {
    const matchQuery = buildMatchQuery(filters.q);
    if (matchQuery) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jobs_fts
          WHERE jobs_fts.job_id = ${jobs.id} AND jobs_fts MATCH ${matchQuery}
        )`,
      );
    }
  }

  return conditions.filter((c): c is NonNullable<typeof c> => c != null);
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

  const matchQuery = filters.q ? buildMatchQuery(filters.q) : "";
  const orderBy =
    filters.sort === "company"
      ? [asc(jobs.company), desc(jobs.postedAt)]
      : matchQuery
        ? [
            sql`(SELECT rank FROM jobs_fts
                WHERE jobs_fts.job_id = ${jobs.id} AND jobs_fts MATCH ${matchQuery})`,
          ]
        : [desc(jobs.postedAt)];

  const rows = await db
    .select()
    .from(jobs)
    .where(and(...jobConditions(filters)))
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);
  return rows.map(toJob);
}

export async function getJobsByBoard(source: string, company: string): Promise<Job[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(
      and(
        sql`lower(${jobs.source}) = ${source.toLowerCase()}`,
        sql`lower(${jobs.company}) = ${company.toLowerCase()}`,
      ),
    );
  return rows.map(toJob);
}

export async function getCompanyNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ value: jobs.company })
    .from(jobs)
    .where(ne(jobs.company, ""))
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

export async function getCompanyStats(company: string): Promise<{
  total: number;
  departments: string[];
  locations: string[];
  sources: string[];
}> {
  const db = await getDb();
  const scope = and(eqJobCompany(company), gte(jobs.postedAt, freshnessCutoff()));

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
