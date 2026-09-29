import { and, asc, countDistinct, desc, eq, gte, ne } from "drizzle-orm";
import type { FacetOptions } from "@/lib/api-types";
import { getReadDb } from "@/server/db";
import { jobLocations, jobs } from "@/server/db/schema";
import { freshnessCutoff } from "@/server/jobs/freshness";

/**
 * Filter options straight from the data: every value offered has fresh jobs,
 * and a newly crawled country or company shows up without a code change.
 * Locations count jobs through job_locations, so a posting with two German
 * offices counts once for Germany and once for each city.
 */
export async function getFacetOptions(): Promise<FacetOptions> {
  const db = await getReadDb();
  const fresh = gte(jobs.postedAt, freshnessCutoff());
  const jobCount = countDistinct(jobs.id);

  const valueCounts = (column: typeof jobs.company | typeof jobs.department) =>
    db
      .select({ value: column, count: jobCount })
      .from(jobs)
      .where(and(fresh, ne(column, "")))
      .groupBy(column)
      .orderBy(asc(column));

  const [countryRows, cityRows, companies, departments] = await Promise.all([
    db
      .select({ value: jobLocations.country, count: jobCount })
      .from(jobLocations)
      .innerJoin(jobs, eq(jobs.id, jobLocations.jobId))
      .where(fresh)
      .groupBy(jobLocations.country)
      .orderBy(desc(jobCount)),
    db
      .select({ country: jobLocations.country, value: jobLocations.city, count: jobCount })
      .from(jobLocations)
      .innerJoin(jobs, eq(jobs.id, jobLocations.jobId))
      .where(and(fresh, ne(jobLocations.city, "")))
      .groupBy(jobLocations.country, jobLocations.city)
      .orderBy(desc(jobCount)),
    valueCounts(jobs.company),
    valueCounts(jobs.department),
  ]);

  return {
    countries: countryRows.map((country) => ({
      ...country,
      cities: cityRows
        .filter((city) => city.country === country.value)
        .map(({ value, count }) => ({ value, count })),
    })),
    companies,
    departments,
  };
}
