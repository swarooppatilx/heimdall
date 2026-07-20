import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AnyColumn } from "drizzle-orm";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  like,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { crawls, jobLocations, jobs } from "../db/schema";
import { resolveEmploymentType } from "./employment";
import { detectExperienceLevel } from "./experience";
import { configureFreshness, freshnessCutoff } from "./freshness";
import { resolvePlace } from "./gazetteer";
import type { Job } from "./job";
import { sanitizeFilterValue } from "./sanitize";
import {
  FILTER_COMPANIES,
  FILTER_DEPARTMENTS,
  FILTER_EMPLOYMENT_TYPES,
  FILTER_EXPERIENCE_LEVELS,
  FILTER_LOCATIONS,
  FILTER_SOURCES,
} from "./taxonomy";

type Db = ReturnType<typeof drizzle>;

let _db: Promise<Db> | null = null;

function getDb(): Promise<Db> {
  if (!_db) {
    _db = (async () => {
      const { env } = await getCloudflareContext();
      configureFreshness((env as { FRESHNESS_DAYS?: string }).FRESHNESS_DAYS);
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
    isRemote: job.isRemote ? 1 : 0,
  };
}

interface LocationFacet {
  city: string;
  country: string;
}

export function locationFacets(job: Job): LocationFacet[] {
  const raw = [job.location, ...(job.locations ?? [])];
  const seen = new Set<string>();
  const facets: LocationFacet[] = [];
  for (const entry of raw) {
    const place = resolvePlace(entry);
    if (!place?.city || !place.country) continue;
    const key = `${place.city}|${place.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facets.push({ city: place.city, country: place.country });
  }
  return facets;
}

function facetStatements(db: Db, job: Job): unknown[] {
  const clear = db.delete(jobLocations).where(eq(jobLocations.jobId, job.id));
  const inserts = locationFacets(job).map((facet) =>
    db.insert(jobLocations).values({ jobId: job.id, ...facet }),
  );
  return [clear, ...inserts];
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
    const statements: unknown[] = [];
    for (const job of page) {
      const values = toRow(job);
      statements.push(
        db
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
              isRemote: values.isRemote,
            },
          }),
      );
      statements.push(...facetStatements(db, job));
    }
    await db.batch(statements as never);
  }
}

export async function updateJobs(items: Job[]): Promise<void> {
  if (items.length === 0) return;
  const db = await getDb();
  for (const page of chunk(items)) {
    const statements: unknown[] = [];
    for (const job of page) {
      const values = toRow(job);
      statements.push(
        db
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
            isRemote: values.isRemote,
          })
          .where(eq(jobs.id, job.id)),
      );
      statements.push(...facetStatements(db, job));
    }
    await db.batch(statements as never);
  }
}

export async function deleteJobsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  for (const page of chunk(ids)) {
    await db.batch([
      db.delete(jobs).where(inArray(jobs.id, page)),
      db.delete(jobLocations).where(inArray(jobLocations.jobId, page)),
    ] as never);
  }
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface CountryFacet {
  value: string;
  count: number;
  cities: FacetOption[];
}

export interface FacetOptions {
  remoteCount: number;
  countries: CountryFacet[];
  companies: FacetOption[];
  employmentTypes: FacetOption[];
  departments: FacetOption[];
  sources: FacetOption[];
  experienceLevels: FacetOption[];
}

export async function getFacetOptions(): Promise<FacetOptions> {
  const db = await getDb();
  const cutoff = freshnessCutoff();

  const [
    remoteRows,
    cityRows,
    countryRows,
    companyRows,
    employmentRows,
    departmentRows,
    sourceRows,
    levelRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(eq(jobs.isRemote, 1), gte(jobs.postedAt, cutoff))),
    db
      .select({
        country: sql<string>`lower(${jobLocations.country})`,
        city: jobLocations.city,
        count: sql<number>`count(*)`,
      })
      .from(jobLocations)
      .innerJoin(jobs, eq(jobs.id, jobLocations.jobId))
      .where(gte(jobs.postedAt, cutoff))
      .groupBy(sql`lower(${jobLocations.country})`, jobLocations.city),
    db
      .select({ value: sql<string>`lower(${jobs.country})`, count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(gte(jobs.postedAt, cutoff), isNotNull(jobs.country)))
      .groupBy(sql`lower(${jobs.country})`),
    db
      .select({
        value: sql<string>`lower(${jobs.company})`,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .where(gte(jobs.postedAt, cutoff))
      .groupBy(sql`lower(${jobs.company})`),
    db
      .select({ value: jobs.employmentType, count: sql<number>`count(*)` })
      .from(jobs)
      .where(and(gte(jobs.postedAt, cutoff), ne(jobs.employmentType, "")))
      .groupBy(jobs.employmentType),
    db
      .select({ value: jobs.department, count: sql<number>`count(*)` })
      .from(jobs)
      .where(gte(jobs.postedAt, cutoff))
      .groupBy(jobs.department),
    db
      .select({ value: jobs.source, count: sql<number>`count(*)` })
      .from(jobs)
      .where(gte(jobs.postedAt, cutoff))
      .groupBy(jobs.source),
    db
      .select({ value: jobs.experienceLevel, count: sql<number>`count(*)` })
      .from(jobs)
      .where(gte(jobs.postedAt, cutoff))
      .groupBy(jobs.experienceLevel),
  ]);

  const cityCounts = new Map<string, number>();
  for (const row of cityRows) {
    if (!row.city) continue;
    cityCounts.set(`${row.country}|${row.city.toLowerCase()}`, Number(row.count));
  }
  const countryCounts = new Map(countryRows.map((r) => [r.value, Number(r.count)] as const));
  const countMap = (rows: { value: string | null; count: number }[]) =>
    new Map(rows.map((r) => [r.value ?? "", Number(r.count)] as const));

  const employmentCounts = countMap(employmentRows);
  const departmentCounts = countMap(departmentRows);
  const sourceCounts = countMap(sourceRows);
  const levelCounts = countMap(levelRows);
  const companyCounts = new Map(companyRows.map((r) => [r.value, Number(r.count)] as const));

  return {
    remoteCount: Number(remoteRows[0]?.count ?? 0),
    countries: FILTER_LOCATIONS.countries.map((value) => ({
      value,
      count: countryCounts.get(value) ?? 0,
      cities: FILTER_LOCATIONS.cities
        .filter((city) => city.country === value)
        .map((city) => ({
          value: city.value,
          count: cityCounts.get(`${value}|${city.value}`) ?? 0,
        })),
    })),

    companies: FILTER_COMPANIES.map((value) => ({
      value,
      count: companyCounts.get(value) ?? 0,
    })),
    employmentTypes: FILTER_EMPLOYMENT_TYPES.map((value) => ({
      value,
      count: employmentCounts.get(value) ?? 0,
    })),
    departments: FILTER_DEPARTMENTS.map((value) => ({
      value,
      count: departmentCounts.get(value) ?? 0,
    })),
    sources: FILTER_SOURCES.map((value) => ({
      value,
      count: sourceCounts.get(value) ?? 0,
    })),
    experienceLevels: FILTER_EXPERIENCE_LEVELS.map((value) => ({
      value,
      count: levelCounts.get(value) ?? 0,
    })),
  };
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
  unresolvedLocationShare: number;
  staleEmploymentTypes: number;
}> {
  const db = await getDb();
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      distinctLocations: sql<number>`count(distinct ${jobs.location})`,
      unknownLocationShare: sql<number>`avg(case when ${jobs.location} = 'unknown' then 1.0 else 0 end)`,
      generalDepartmentShare: sql<number>`avg(case when ${jobs.department} = 'general' then 1.0 else 0 end)`,
      unresolvedLocationShare: sql<number>`avg(case when ${jobs.city} is null and ${jobs.location} not in ('unknown', 'Remote') then 1.0 else 0 end)`,
      staleEmploymentTypes: sql<number>`count(case when ${jobs.employmentType} != '' and ${jobs.employmentType} not in ('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN') then 1 end)`,
    })
    .from(jobs);
  return {
    total: Number(row?.total ?? 0),
    distinctLocations: Number(row?.distinctLocations ?? 0),
    unknownLocationShare: Number(row?.unknownLocationShare ?? 0),
    generalDepartmentShare: Number(row?.generalDepartmentShare ?? 0),
    unresolvedLocationShare: Number(row?.unresolvedLocationShare ?? 0),
    staleEmploymentTypes: Number(row?.staleEmploymentTypes ?? 0),
  };
}

export async function deleteStaleJobs(): Promise<number> {
  const db = await getDb();
  const result = await db.delete(jobs).where(lt(jobs.postedAt, freshnessCutoff()));
  return result.meta.changes ?? 0;
}

export async function deleteOldCrawls(days: number): Promise<number> {
  const db = await getDb();
  const result = await db.run(
    sql`DELETE FROM ${crawls} WHERE ${crawls.createdAt} < datetime('now', ${`-${days} days`})`,
  );
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
