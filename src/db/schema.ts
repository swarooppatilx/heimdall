import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location").notNull(),
    department: text("department").notNull(),
    url: text("url").notNull(),
    postedAt: text("posted_at").notNull(),
    source: text("source").notNull(),
    employmentType: text("employment_type").notNull().default(""),
    salary: text("salary").notNull().default(""),
    locations: text("locations").notNull().default("[]"),
    region: text("region").notNull().default(""),
    isEarlyCareer: integer("is_early_career").notNull().default(0),
    experienceLevel: text("experience_level").notNull().default("mid"),
    city: text("city"),
    country: text("country"),
    isRemote: integer("is_remote").notNull().default(0),
    normVersion: integer("norm_version").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_jobs_posted_at").on(table.postedAt),
    index("idx_jobs_company_posted_at").on(table.company, table.postedAt),
    index("idx_jobs_city_country").on(table.city, table.country),
  ],
);

export const jobLocations = sqliteTable(
  "job_locations",
  {
    jobId: text("job_id").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull(),
  },
  (table) => [
    index("idx_job_locations_country_city").on(table.country, table.city),
    index("idx_job_locations_job").on(table.jobId),
  ],
);

export const crawls = sqliteTable(
  "crawls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    company: text("company").notNull(),
    status: text("status").notNull().default("ok"),
    jobsFound: integer("jobs_found").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    error: text("error"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_crawls_created_at").on(table.createdAt)],
);
