import { detectExperienceLevel } from "./experience";
import type { Job } from "./job";

export interface JobDiff {
  inserts: Job[];
  updates: Job[];
  deletedIds: string[];
}

const DRIFT_MS = 60 * 1000;

function effectiveLevel(job: Job): string {
  return job.experienceLevel ?? detectExperienceLevel(job.title);
}

function samePosting(a: Job, b: Job): boolean {
  return (
    a.title === b.title &&
    a.location === b.location &&
    a.department === b.department &&
    a.url === b.url &&
    Math.abs(a.postedAt.getTime() - b.postedAt.getTime()) < DRIFT_MS &&
    (a.employmentType ?? "") === (b.employmentType ?? "") &&
    (a.salary ?? "") === (b.salary ?? "") &&
    JSON.stringify(a.locations ?? []) === JSON.stringify(b.locations ?? []) &&
    (a.region ?? "") === (b.region ?? "") &&
    Boolean(a.isEarlyCareer) === Boolean(b.isEarlyCareer) &&
    effectiveLevel(a) === effectiveLevel(b)
  );
}

export function diffJobs(existing: Job[], fetched: Job[]): JobDiff {
  const existingById = new Map(existing.map((job) => [job.id, job]));
  const fetchedIds = new Set(fetched.map((job) => job.id));

  const inserts: Job[] = [];
  const updates: Job[] = [];

  for (const job of fetched) {
    const current = existingById.get(job.id);
    if (!current) {
      inserts.push(job);
    } else if (!samePosting(current, job)) {
      updates.push(job);
    }
  }

  const deletedIds = existing.filter((job) => !fetchedIds.has(job.id)).map((job) => job.id);

  return { inserts, updates, deletedIds };
}
