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
    experienceLevel: text("experience_level").notNull().default("mid"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_jobs_posted_at").on(table.postedAt),
    index("idx_jobs_company_posted_at").on(table.company, table.postedAt),
  ],
);

export const crawls = sqliteTable("crawls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  company: text("company").notNull(),
  status: text("status").notNull().default("ok"),
  jobsFound: integer("jobs_found").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
