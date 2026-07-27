import { and, eq, gte, isNotNull, ne, sql } from "drizzle-orm";
import { jobLocations, jobs } from "../db/schema";
import { getDb } from "./db-connection";
import { freshnessCutoff } from "./freshness";
import {
  FILTER_COMPANIES,
  FILTER_DEPARTMENTS,
  FILTER_EMPLOYMENT_TYPES,
  FILTER_EXPERIENCE_LEVELS,
  FILTER_LOCATIONS,
  FILTER_SOURCES,
} from "./taxonomy";

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
