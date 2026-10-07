import {
  type AnyColumn,
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  lt,
  ne,
  sql,
} from "drizzle-orm";
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
import { currentFreshnessDays, freshnessCutoff } from "@/server/jobs/freshness";
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

function jobConditions(filters: JobFilters, cutoff: string) {
  const conditions = [
    gte(jobs.postedAt, cutoff),
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

// FTS5 applies bm25 column weights to term frequency before saturation, so
// even a 10x title weight barely separates a title hit from a company hit.
// Ranking on a title-only score first (0 when the title doesn't match), then
// on the score over every searched column, makes title matches lead. job_id
// is indexed only for writes and never searched.
const TITLE_ONLY = sql.raw("1, 0, 0, 0, 0");
const SEARCHED_COLUMNS = sql.raw("1, 1, 1, 1, 0");

function rankedMatches(match: string) {
  return sql`(SELECT job_id, bm25(jobs_fts, ${TITLE_ONLY}) AS title_score, bm25(jobs_fts, ${SEARCHED_COLUMNS}) AS score FROM jobs_fts WHERE jobs_fts MATCH ${match}) AS ranked`;
}

// bm25 is negative and lower is better. Scaling it up to 2x across the
// freshness window lets a newer posting win among near-equal matches. Age is
// measured from the hour-rounded cutoff, not now, so the order holds still
// across the pages of one scroll.
function relevance(cutoff: string) {
  const freshness = sql`(1 + (julianday(${jobs.postedAt}) - julianday(${cutoff})) / ${currentFreshnessDays()})`;
  return [sql`ranked.title_score * ${freshness}`, sql`ranked.score * ${freshness}`];
}

// id breaks ties so offsets are stable: many ATSes post date-only timestamps.
function dateOrCompanyOrder(sort: string | undefined) {
  return sort === "company"
    ? [asc(jobs.company), desc(jobs.postedAt), desc(jobs.id)]
    : [desc(jobs.postedAt), desc(jobs.id)];
}

export async function searchJobsWithCount(
  filters: JobFilters,
  page?: PageOptions,
): Promise<SearchResult> {
  const db = await getReadDb();

  const limit = Math.min(Math.max(page?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(page?.offset ?? 0, 0);

  const cutoff = freshnessCutoff();
  const conditions = and(...jobConditions(filters, cutoff));
  const { q, ...unsearched } = filters;
  const match = q ? buildMatchQuery(q) : "";

  // A search with no explicit sort is ordered by match quality. The join
  // replaces the search condition, so the index is matched once.
  const rows =
    match && !filters.sort
      ? db
          .select(getTableColumns(jobs))
          .from(jobs)
          .innerJoin(rankedMatches(match), sql`ranked.job_id = ${jobs.id}`)
          .where(and(...jobConditions(unsearched, cutoff)))
          .orderBy(...relevance(cutoff), desc(jobs.id))
      : db
          .select()
          .from(jobs)
          .where(conditions)
          .orderBy(...dateOrCompanyOrder(filters.sort));

  // The capped count reads up to COUNT_CAP rows, so it runs once per search,
  // on the first page, not on every page of an infinite scroll.
  const [jobRows, countResult] = await Promise.all([
    rows.limit(limit).offset(offset),
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
