import type { Job } from "@/lib/job";
import { logEvent } from "@/lib/logger";

export function mapPostings<T>(
  postings: readonly T[] | undefined,
  company: string,
  map: (posting: T) => Job,
): Job[] {
  const jobs: Job[] = [];
  let skipped = 0;
  for (const posting of postings ?? []) {
    try {
      jobs.push(map(posting));
    } catch {
      skipped += 1;
    }
  }
  if (skipped > 0) logEvent("postings_skipped", { company, skipped });
  return jobs;
}
