import { MS_PER_DAY } from "@/lib/time";

export const DAY_MS = MS_PER_DAY;

export const DEFAULT_FRESHNESS_DAYS = 15;
const MIN_FRESHNESS_DAYS = 1;
const MAX_FRESHNESS_DAYS = 90;

let freshnessDays = DEFAULT_FRESHNESS_DAYS;

/** Configures the number of days before a job is considered stale. Clamped to 1–90. */
export function configureFreshness(days: unknown): void {
  const parsed = Number(days);
  if (Number.isFinite(parsed) && parsed >= MIN_FRESHNESS_DAYS && parsed <= MAX_FRESHNESS_DAYS) {
    freshnessDays = Math.floor(parsed);
  }
}

/** Returns the current freshness threshold in days. */
export function currentFreshnessDays(): number {
  return freshnessDays;
}

/** Returns an ISO string for the cutoff date before which jobs are considered stale. */
export function freshnessCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - freshnessDays * DAY_MS).toISOString();
}
