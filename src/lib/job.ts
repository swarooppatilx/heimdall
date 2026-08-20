export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  department: string;
  url: string;
  postedAt: Date;
  source: string;
  employmentType?: string;
  salary?: string;
  locations?: string[];
  region?: string;
  isEarlyCareer?: boolean;
  experienceLevel?: string;
  city?: string;
  country?: string;
  isRemote?: boolean;
}

export interface DedupedJob {
  key: string;
  job: Job;
  openings: number;
}

export function dedupeJobs(jobs: Job[], keyFn: (job: Job) => string): DedupedJob[] {
  const primary = new Map<string, Job>();
  const counts = new Map<string, number>();
  for (const job of jobs) {
    if (!(job.title && job.company)) continue;
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
