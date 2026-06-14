import { createClient, type Client } from "@libsql/client";
import { detectExperienceLevel } from "./experience";
import { freshnessCutoff } from "./freshness";
import type { Job } from "./job";

const LIBSQL_URL = process.env.LIBSQL_URL ?? "file:heimdall.db";

let _client: Promise<Client> | null = null;

function getClient(): Promise<Client> {
  if (!_client) {
    _client = initClient();
  }
  return _client;
}

async function initClient(): Promise<Client> {
  const client = createClient({
    url: LIBSQL_URL,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  });

  await client.execute(`
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS crawls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',
      jobs_found INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return client;
}

function toJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    title: String(row.title),
    company: String(row.company),
    location: String(row.location),
    department: String(row.department),
    url: String(row.url),
    postedAt: new Date(String(row.posted_at)),
    source: String(row.source),
    experienceLevel: String(row.experience_level),
  };
}

export async function upsertJobs(jobs: Job[]): Promise<number> {
  const client = await getClient();
  if (jobs.length === 0) return 0;

  const statements = jobs.map((job) => ({
    sql: `
      INSERT INTO jobs (id, title, company, location, department, url, posted_at, source, experience_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        location = excluded.location,
        department = excluded.department,
        url = excluded.url,
        posted_at = excluded.posted_at,
        experience_level = excluded.experience_level
    `,
    args: [
      job.id,
      job.title,
      job.company,
      job.location,
      job.department,
      job.url,
      job.postedAt.toISOString(),
      job.source,
      detectExperienceLevel(job.title),
    ],
  }));

  await client.batch(statements, "write");
  return jobs.length;
}

export async function getAllJobs(): Promise<Job[]> {
  const client = await getClient();
  const result = await client.execute({
    sql: "SELECT * FROM jobs WHERE posted_at >= ? ORDER BY posted_at DESC",
    args: [freshnessCutoff()],
  });
  return result.rows.map(toJob);
}

export async function getFilterOptions(): Promise<{
  companies: string[];
  locations: string[];
  sources: string[];
}> {
  const client = await getClient();
  const cutoff = freshnessCutoff();

  const companies = await client.execute({
    sql: "SELECT DISTINCT company FROM jobs WHERE posted_at >= ? ORDER BY company",
    args: [cutoff],
  });
  const locations = await client.execute({
    sql: "SELECT DISTINCT location FROM jobs WHERE posted_at >= ? ORDER BY location",
    args: [cutoff],
  });
  const sources = await client.execute({
    sql: "SELECT DISTINCT source FROM jobs WHERE posted_at >= ? ORDER BY source",
    args: [cutoff],
  });

  return {
    companies: companies.rows.map((r) => String(r.company)),
    locations: locations.rows.map((r) => String(r.location)),
    sources: sources.rows.map((r) => String(r.source)),
  };
}

export async function getJobsByCompany(company: string): Promise<Job[]> {
  const client = await getClient();
  const result = await client.execute({
    sql: "SELECT * FROM jobs WHERE company = ? AND posted_at >= ? ORDER BY posted_at DESC",
    args: [company, freshnessCutoff()],
  });
  return result.rows.map(toJob);
}

export async function getCompanyStats(company: string): Promise<{
  total: number;
  departments: string[];
  locations: string[];
  sources: string[];
}> {
  const client = await getClient();
  const cutoff = freshnessCutoff();

  const total = await client.execute({
    sql: "SELECT COUNT(*) AS count FROM jobs WHERE company = ? AND posted_at >= ?",
    args: [company, cutoff],
  });
  const departments = await client.execute({
    sql: "SELECT DISTINCT department FROM jobs WHERE company = ? AND posted_at >= ? ORDER BY department",
    args: [company, cutoff],
  });
  const locations = await client.execute({
    sql: "SELECT DISTINCT location FROM jobs WHERE company = ? AND posted_at >= ? ORDER BY location",
    args: [company, cutoff],
  });
  const sources = await client.execute({
    sql: "SELECT DISTINCT source FROM jobs WHERE company = ? AND posted_at >= ? ORDER BY source",
    args: [company, cutoff],
  });

  return {
    total: Number(total.rows[0]?.count ?? 0),
    departments: departments.rows.map((r) => String(r.department)),
    locations: locations.rows.map((r) => String(r.location)),
    sources: sources.rows.map((r) => String(r.source)),
  };
}

export async function getJobCount(): Promise<number> {
  const client = await getClient();
  const result = await client.execute({
    sql: "SELECT COUNT(*) as count FROM jobs WHERE posted_at >= ?",
    args: [freshnessCutoff()],
  });
  return Number(result.rows[0]?.count ?? 0);
}

export async function deleteStaleJobs(): Promise<number> {
  const client = await getClient();
  const result = await client.execute({
    sql: "DELETE FROM jobs WHERE posted_at < ?",
    args: [freshnessCutoff()],
  });
  return result.rowsAffected;
}

export async function recordCrawl(
  company: string,
  status: string,
  jobsFound: number,
  durationMs: number,
  error?: string,
): Promise<void> {
  const client = await getClient();
  await client.execute({
    sql: "INSERT INTO crawls (company, status, jobs_found, duration_ms, error) VALUES (?, ?, ?, ?, ?)",
    args: [company, status, jobsFound, durationMs, error ?? null],
  });
}

interface CrawlRecord {
  company: string;
  status: string;
  jobsFound: number;
  durationMs: number;
  error: string | null;
  createdAt: string;
}

function toCrawlRecord(row: Record<string, unknown>): CrawlRecord {
  return {
    company: String(row.company),
    status: String(row.status),
    jobsFound: Number(row.jobsFound),
    durationMs: Number(row.durationMs),
    error: row.error === null ? null : String(row.error),
    createdAt: String(row.createdAt),
  };
}

export async function getCrawlHistory(): Promise<CrawlRecord[]> {
  const client = await getClient();
  const result = await client.execute(
    "SELECT company, status, jobs_found as jobsFound, duration_ms as durationMs, error, created_at as createdAt FROM crawls ORDER BY created_at DESC LIMIT 100",
  );
  return result.rows.map(toCrawlRecord);
}

export async function getLatestCrawls(): Promise<CrawlRecord[]> {
  const client = await getClient();
  const result = await client.execute(
    "SELECT company, status, jobs_found as jobsFound, duration_ms as durationMs, error, created_at as createdAt FROM crawls WHERE id IN (SELECT MAX(id) FROM crawls GROUP BY company)",
  );
  return result.rows.map(toCrawlRecord);
}
