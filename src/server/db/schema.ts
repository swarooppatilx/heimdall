import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { LEVELS } from "@/lib/level";

const CRAWL_STATUSES = ["ok", "error"] as const;
const SOURCE_STATUSES = ["active", "degraded", "dead"] as const;

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
    salary: text("salary").notNull().default(""),
    locations: text("locations").notNull().default("[]"),
    level: text("experience_level", { enum: LEVELS }).notNull().default("mid"),
    city: text("city"),
    country: text("country"),
    isRemote: integer("is_remote").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_jobs_posted_at").on(table.postedAt),
    index("idx_jobs_company_posted_at").on(table.company, table.postedAt),
    index("idx_jobs_city_country").on(table.city, table.country),
    index("idx_jobs_source_company").on(table.source, table.company),
    index("idx_jobs_department").on(table.department),
    index("idx_jobs_experience_level").on(table.level),
    index("idx_jobs_is_remote").on(table.isRemote),
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

// One row per board with its latest crawl, so status, drift and
// If-Modified-Since never scan the crawl history.
export const boardStatus = sqliteTable("board_status", {
  board: text("board").primaryKey(),
  status: text("status", { enum: CRAWL_STATUSES }).notNull(),
  jobsFound: integer("jobs_found").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  lastModified: text("last_modified"),
  consecutiveEmpty: integer("consecutive_empty").notNull().default(0),
  changedAt: text("changed_at"),
  crawledAt: text("crawled_at").notNull().default(sql`(datetime('now'))`),
});

// The boards we crawl. Seeded from sources.seed.json (migration 0025); the
// cron degrades and restores boards by crawl drift, `dead` is set by hand.
export const sources = sqliteTable(
  "sources",
  {
    board: text("board").primaryKey(),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    label: text("label"),
    status: text("status", { enum: SOURCE_STATUSES }).notNull().default("active"),
    addedAt: text("added_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [index("idx_sources_status").on(table.status)],
);
