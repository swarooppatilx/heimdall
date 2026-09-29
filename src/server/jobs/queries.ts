import { type AnyColumn, and, asc, count, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import type { Job } from "@/lib/job";
import {
  COUNT_CAP,
  DEFAULT_LIMIT,
  type JobFilters,
  MAX_LIMIT,
  type PageOptions,
  POSTED_WINDOWS_MS,
  type SearchResult,
} from "@/lib/search-params";
import { isHttpUrl } from "@/lib/url";
import { getDb, getReadDb } from "@/server/db";
import { jobLocations, jobs } from "@/server/db/schema";
import { freshnessCutoff } from "@/server/jobs/freshness";
import { buildMatchQuery } from "@/server/jobs/fts";
import { sanitizeFilterValue } from "@/server/jobs/sanitize";
import { resolvePlace } from "@/server/locations/gazetteer";

function parseLocations(raw: string, fallback: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [fallback];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [fallback];
  }
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
    salary: row.salary,
    locations: parseLocations(row.locations, row.location),
    level: row.level,
    ...(row.city === null ? {} : { city: row.city }),
    ...(row.country === null ? {} : { country: row.country }),
    isRemote: row.isRemote === 1,
  };
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function searchCondition(value: string | undefined) {
  if (!value) return undefined;
  const match = buildMatchQuery(value);
  // A query with nothing searchable ("+++") matches nothing; dropping it would
  // return every job while the URL still claims a search.
  if (!match) return sql`0`;
  return inArray(jobs.id, sql`(SELECT job_id FROM jobs_fts WHERE jobs_fts MATCH ${match})`);
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

function eqColumn(column: AnyColumn, value: string) {
  return sql`${column} = ${value}`;
}

// Job links render as hrefs. Ingest already rejects non-http(s) URLs; this
// keeps any row that slipped in another way off the page.
function toRenderableJobs(rows: (typeof jobs.$inferSelect)[]): Job[] {
  return rows.filter((row) => isHttpUrl(row.url)).map(toJob);
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
  return eqColumn(column, sanitizeFilterValue(value));
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
    searchCondition(filters.q),
    companyCondition(filters.company),
    locationCondition(filters.location),
    cityCountryCondition(filters.city, filters.country),
    columnCondition(jobs.department, filters.department),
    columnCondition(jobs.level, filters.level),
    postedCondition(filters.posted),
  ];

  return conditions.filter((c): c is NonNullable<typeof c> => c != null);
}

export async function searchJobsWithCount(
  filters: JobFilters,
  page?: PageOptions,
): Promise<SearchResult> {
  const db = await getReadDb();

  const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(page?.offset ?? 0, 0);

  const orderBy =
    // id breaks ties so offsets are stable: many ATSes post date-only timestamps.
    filters.sort === "company"
      ? [asc(jobs.company), desc(jobs.postedAt), desc(jobs.id)]
      : [desc(jobs.postedAt), desc(jobs.id)];

  const conditions = and(...jobConditions(filters));

  // The capped count reads up to COUNT_CAP rows, so it runs once per search,
  // on the first page, not on every page of an infinite scroll.
  const [jobRows, countResult] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(conditions)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    offset === 0
      ? db
          .select({ value: count() })
          .from(
            db.select({ one: sql`1` }).from(jobs).where(conditions).limit(COUNT_CAP).as("capped"),
          )
      : null,
  ]);

  return {
    jobs: toRenderableJobs(jobRows),
    total: countResult ? (countResult[0]?.value ?? 0) : null,
  };
}

// "." is the character right after "-", so this is an index range over one
// board's ids that excludes boards sharing the prefix ("doordash" vs "doordashusa").
export function idPrefixRange(prefix: string): { from: string; to: string } {
  return { from: prefix, to: `${prefix.slice(0, -1)}.` };
}

/**
 * A board's stored jobs that are still fresh. Expired rows are left to the
 * stale sweep; counting them here would make every expiry look like a mass
 * deletion and trip the suspicious-diff guard.
 */
export async function getJobsByIdPrefix(prefix: string): Promise<Job[]> {
  const db = await getDb();
  const { from, to } = idPrefixRange(prefix);
  const rows = await db
    .select()
    .from(jobs)
    .where(and(gte(jobs.id, from), lt(jobs.id, to), gte(jobs.postedAt, freshnessCutoff())));
  return rows.map(toJob);
}

export interface CompanyEntry {
  name: string;
  lastPostedAt: string;
}

/** Companies with fresh jobs and their newest posting, read off the (company, posted_at) index. */
export async function getCompanyIndex(): Promise<CompanyEntry[]> {
  const db = await getReadDb();
  return db
    .select({ name: jobs.company, lastPostedAt: sql<string>`max(${jobs.postedAt})` })
    .from(jobs)
    .where(and(ne(jobs.company, ""), gte(jobs.postedAt, freshnessCutoff())))
    .groupBy(jobs.company)
    .orderBy(asc(jobs.company));
}

export async function getJobsByCompany(company: string): Promise<Job[]> {
  const db = await getReadDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eqJobCompany(company), gte(jobs.postedAt, freshnessCutoff())))
    .orderBy(desc(jobs.postedAt));
  return toRenderableJobs(rows);
}

export async function getRecentJobs(limit: number): Promise<Job[]> {
  const db = await getReadDb();
  const rows = await db
    .select()
    .from(jobs)
    .where(gte(jobs.postedAt, freshnessCutoff()))
    .orderBy(desc(jobs.postedAt))
    .limit(limit);
  return toRenderableJobs(rows);
}
