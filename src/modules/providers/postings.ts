import { formatError, logEvent } from "@/lib/logger";
import type { Job } from "@/modules/jobs/job";

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
    } catch (err) {
      logEvent("posting_map_error", { company, error: formatError(err) });
      skipped += 1;
    }
  }
  if (skipped > 0) logEvent("postings_skipped", { company, skipped });
  return jobs;
}
