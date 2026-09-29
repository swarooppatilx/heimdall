import { fold } from "@/lib/fold";
import type { Level } from "@/lib/level";

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  department: string;
  url: string;
  postedAt: Date;
  source: string;
  salary?: string;
  locations?: string[];
  level?: Level;
  city?: string;
  country?: string;
  isRemote?: boolean;
  /** Raw ATS team/function names after `department`, in order; resolved at ingest, never stored. */
  departmentHints?: string[];
}

/**
 * A job as it crosses the wire in `/api/jobs` and the home page payload: only
 * the fields a job card shows, with the date as an ISO string. Location facets
 * and flags stay on the server, where filtering happens.
 */
export type JobDto = Pick<
  Job,
  "id" | "title" | "company" | "location" | "url" | "source" | "salary"
> & {
  postedAt: string;
};

export function toJobDto(job: Job): JobDto {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    source: job.source,
    postedAt: job.postedAt.toISOString(),
    ...(job.salary ? { salary: job.salary } : {}),
  };
}

/** Two listings are the same role when company and title match, ignoring case and accents. */
export function dedupeKey(job: Pick<Job, "company" | "title">): string {
  return `${fold(job.company)}|${fold(job.title)}`;
}

export interface DedupedJob<T = Job> {
  key: string;
  job: T;
  openings: number;
}

export function dedupeJobs<T>(jobs: T[], keyFn: (job: T) => string): DedupedJob<T>[] {
  const primary = new Map<string, T>();
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const key = keyFn(job);
    if (!primary.has(key)) primary.set(key, job);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...primary.entries()].map(([key, job]) => ({
    key,
    job,
    openings: counts.get(key) ?? 1,
  }));
}
