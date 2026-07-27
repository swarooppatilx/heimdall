import { sql } from "drizzle-orm";
import { jobs } from "../db/schema";
import { getDb } from "./db-connection";

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
