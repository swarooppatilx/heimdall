import type { AnyColumn } from "drizzle-orm";
import { and, asc, count, desc, eq, gte, like, ne, sql } from "drizzle-orm";
import { jobLocations, jobs } from "../db/schema";
import { getDb } from "./db-connection";
import { resolveEmploymentType } from "./employment";
import { freshnessCutoff } from "./freshness";
import { resolvePlace } from "./gazetteer";
import type { Job } from "./job";
import { sanitizeFilterValue } from "./sanitize";
import { buildMatchQuery } from "./search";

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

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const POSTED_WINDOWS_MS: Record<string, number> = {
  today: MS_PER_DAY,
  week: DAYS_PER_WEEK * MS_PER_DAY,
};

export interface PageOptions {
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

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

function jobConditions(filters: JobFilters) {
  const conditions = [gte(jobs.postedAt, freshnessCutoff())];

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
  if (filters.company) {
    conditions.push(eqJobCompany(sanitizeFilterValue(filters.company)));
  }
  if (filters.location) {
    const place = resolvePlace(filters.location);
    if (place?.remote) {
      conditions.push(eq(jobs.isRemote, 1));
    } else if (place?.city) {
      conditions.push(facetMatch(place.city, place.country));
    } else if (place?.country) {
      conditions.push(facetMatch(undefined, place.country));
    } else {
      conditions.push(like(jobs.location, `%${filters.location}%`));
    }
  }
  if (filters.city) {
    conditions.push(facetMatch(filters.city, filters.country));
  } else if (filters.country) {
    conditions.push(facetMatch(undefined, filters.country));
  }
  if (filters.source) {
    conditions.push(eqColumnLower(jobs.source, sanitizeFilterValue(filters.source)));
  }
  if (filters.experience) {
    conditions.push(eqColumnLower(jobs.experienceLevel, sanitizeFilterValue(filters.experience)));
  }
  if (filters.department) {
    conditions.push(eqColumnLower(jobs.department, sanitizeFilterValue(filters.department)));
  }
  if (filters.employmentType) {
    const resolved = resolveEmploymentType(sanitizeFilterValue(filters.employmentType));
    conditions.push(
      eqColumnLower(jobs.employmentType, resolved ?? sanitizeFilterValue(filters.employmentType)),
    );
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
