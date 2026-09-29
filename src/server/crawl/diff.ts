import type { Job } from "@/lib/job";
import { MS_PER_SECOND } from "@/lib/time";

export interface ChangedFields {
  location: boolean;
  core: boolean;
}

interface JobDiff {
  inserts: Job[];
  updates: Array<{ job: Job; changed: ChangedFields }>;
  deletedIds: string[];
}

const DRIFT_MS = 60 * MS_PER_SECOND;
const GUARD_MIN_EXISTING = 10;
const GUARD_MAX_DELETE_SHARE = 0.5;

export function isSuspiciousDeletion(existingCount: number, deletedCount: number): boolean {
  if (existingCount < GUARD_MIN_EXISTING) return false;
  return deletedCount > existingCount * GUARD_MAX_DELETE_SHARE;
}

function sameLocations(a: Job, b: Job): boolean {
  return [...(a.locations ?? [])].sort().join(",") === [...(b.locations ?? [])].sort().join(",");
}

function detectChanges(a: Job, b: Job): ChangedFields {
  return {
    location:
      a.location !== b.location ||
      !sameLocations(a, b) ||
      a.city !== b.city ||
      a.country !== b.country ||
      a.isRemote !== b.isRemote,
    core:
      a.company !== b.company ||
      a.title !== b.title ||
      a.department !== b.department ||
      a.url !== b.url ||
      (a.salary ?? "") !== (b.salary ?? "") ||
      a.level !== b.level,
  };
}

function samePostedAt(a: Job, b: Job): boolean {
  return Math.abs(a.postedAt.getTime() - b.postedAt.getTime()) < DRIFT_MS;
}

export function diffJobs(existing: Job[], fetched: Job[]): JobDiff {
  const existingById = new Map(existing.map((job) => [job.id, job]));
  const fetchedIds = new Set(fetched.map((job) => job.id));

  const inserts: Job[] = [];
  const updates: Array<{ job: Job; changed: ChangedFields }> = [];

  for (const job of fetched) {
    const current = existingById.get(job.id);
    if (!current) {
      inserts.push(job);
      continue;
    }
    const effective =
      job.postedAt.getTime() > current.postedAt.getTime() + DRIFT_MS
        ? { ...job, postedAt: current.postedAt }
        : job;
    const changed = detectChanges(current, effective);
    if (changed.location || changed.core || !samePostedAt(current, effective)) {
      updates.push({ job: effective, changed });
    }
  }

  const deletedIds = existing.filter((job) => !fetchedIds.has(job.id)).map((job) => job.id);

  return { inserts, updates, deletedIds };
}
