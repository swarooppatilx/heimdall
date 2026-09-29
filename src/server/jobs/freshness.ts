import { MS_PER_DAY, MS_PER_HOUR } from "@/lib/time";

export const DEFAULT_FRESHNESS_DAYS = 15;
// Guards against a mistyped FRESHNESS_DAYS emptying the site or keeping months of stale jobs.
const MIN_FRESHNESS_DAYS = 1;
const MAX_FRESHNESS_DAYS = 90;

let freshnessDays: number | undefined;

function parseDays(days: unknown): number | undefined {
  const parsed = Number(days);
  if (!Number.isFinite(parsed) || parsed < MIN_FRESHNESS_DAYS || parsed > MAX_FRESHNESS_DAYS) {
    return undefined;
  }
  return Math.floor(parsed);
}

export function configureFreshness(days: unknown): void {
  const parsed = parseDays(days);
  if (parsed !== undefined) freshnessDays = parsed;
}

/**
 * Returns the current freshness threshold in days. Falls back to the
 * FRESHNESS_DAYS var (exposed on process.env by nodejs_compat) so request
 * handlers agree with the crawler without wiring config through every route.
 */
export function currentFreshnessDays(): number {
  freshnessDays ??= parseDays(process.env.FRESHNESS_DAYS) ?? DEFAULT_FRESHNESS_DAYS;
  return freshnessDays;
}

/**
 * The oldest posting time still shown. Rounded down to the hour so every page
 * of one paginated read sees the same result set; a cutoff that moved by the
 * millisecond would shift offsets between page requests.
 */
export function freshnessCutoff(now: Date = new Date()): string {
  const hourStart = Math.floor(now.getTime() / MS_PER_HOUR) * MS_PER_HOUR;
  return new Date(hourStart - currentFreshnessDays() * MS_PER_DAY).toISOString();
}
