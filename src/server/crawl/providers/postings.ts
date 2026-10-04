import type { z } from "zod";
import type { Job } from "@/lib/job";
import { logEvent } from "@/server/logger";

export interface ProviderResult {
  jobs: Job[];
  validator: string | null;
  /** False when only part of the board was fetched; its missing jobs must not be deleted. */
  complete: boolean;
}

function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".")}: ${issue.message}` : error.message;
}

/**
 * Validates and maps each posting on its own, so one malformed posting is
 * skipped instead of failing the whole board. Skips are summarized in a
 * single log line with the first reason.
 */
export function mapPostings<S extends z.ZodType>(
  postings: readonly unknown[] | null | undefined,
  company: string,
  schema: S,
  map: (posting: z.infer<S>) => Job,
): Job[] {
  const jobs: Job[] = [];
  let skipped = 0;
  let firstReason: string | undefined;
  for (const posting of postings ?? []) {
    const parsed = schema.safeParse(posting);
    try {
      if (!parsed.success) throw new Error(describeIssue(parsed.error));
      jobs.push(map(parsed.data));
    } catch (err) {
      skipped += 1;
      firstReason ??= err instanceof Error ? err.message : String(err);
    }
  }
  if (skipped > 0) logEvent("postings_skipped", { company, skipped, reason: firstReason });
  return jobs;
}
