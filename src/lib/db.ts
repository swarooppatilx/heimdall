import path from "node:path";
import Database from "better-sqlite3";
import { detectExperienceLevel } from "./experience";
import type { Job } from "./job";

const DB_PATH = path.join(process.cwd(), "heimdall.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        department TEXT NOT NULL,
        url TEXT NOT NULL,
        posted_at TEXT NOT NULL,
        source TEXT NOT NULL,
        experience_level TEXT NOT NULL DEFAULT 'mid',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const columns = _db.prepare("PRAGMA table_info(jobs)").all() as { name: string }[];
    if (!columns.some((c) => c.name === "experience_level")) {
      _db.exec("ALTER TABLE jobs ADD COLUMN experience_level TEXT NOT NULL DEFAULT 'mid'");
    }
  }
  return _db;
}

export function upsertJobs(jobs: Job[]): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO jobs (id, title, company, location, department, url, posted_at, source, experience_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      location = excluded.location,
      department = excluded.department,
      url = excluded.url,
      posted_at = excluded.posted_at,
      experience_level = excluded.experience_level
  `);

  const insert = db.transaction((items: Job[]) => {
    for (const job of items) {
      stmt.run(
        job.id,
        job.title,
        job.company,
        job.location,
        job.department,
        job.url,
        job.postedAt.toISOString(),
        job.source,
        detectExperienceLevel(job.title),
      );
    }
  });

  insert(jobs);
  return jobs.length;
}

export function getAllJobs(): Job[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM jobs ORDER BY posted_at DESC").all() as {
    id: string;
    title: string;
    company: string;
    location: string;
    department: string;
    url: string;
    posted_at: string;
    source: string;
    experience_level: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    department: row.department,
    url: row.url,
    postedAt: new Date(row.posted_at),
    source: row.source,
    experienceLevel: row.experience_level,
  }));
}

export function getFilterOptions(): {
  companies: string[];
  locations: string[];
  sources: string[];
} {
  const db = getDb();
  const companies = (
    db.prepare("SELECT DISTINCT company FROM jobs ORDER BY company").all() as { company: string }[]
  ).map((r) => r.company);
  const locations = (
    db.prepare("SELECT DISTINCT location FROM jobs ORDER BY location").all() as {
      location: string;
    }[]
  ).map((r) => r.location);
  const sources = (
    db.prepare("SELECT DISTINCT source FROM jobs ORDER BY source").all() as { source: string }[]
  ).map((r) => r.source);
  return { companies, locations, sources };
}

export function getJobCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM jobs").get() as { count: number };
  return row.count;
}
