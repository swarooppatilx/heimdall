export const FRESHNESS_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

export function freshnessCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - FRESHNESS_DAYS * DAY_MS).toISOString();
}
