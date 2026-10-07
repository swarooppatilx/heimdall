import type { Job } from "@/lib/job";
import { LEVELS } from "@/lib/level";
import { MS_PER_DAY } from "@/lib/time";

const DAYS_PER_WEEK = 7;
export const POSTED_WINDOWS_MS: Record<string, number> = {
  today: MS_PER_DAY,
  week: DAYS_PER_WEEK * MS_PER_DAY,
};

type PostedWindow = "today" | "week";
export const POSTED_WINDOWS: PostedWindow[] = ["today", "week"];

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;

// Counting stops here: D1 bills every row a count scans, and the UI only
// needs "1000+" beyond this point.
export const COUNT_CAP = 1000;

export interface JobFilters {
  q?: string;
  company?: string;
  location?: string;
  city?: string;
  country?: string;
  posted?: string;
  department?: string;
  level?: string;
  sort?: string;
}

export interface PageOptions {
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  jobs: Job[];
  /** Counted on the first page only; later pages reuse it. */
  total: number | null;
}

export const MAX_OFFSET = 10_000;
export const MAX_QUERY_LENGTH = 200;
const MAX_FILTER_LENGTH = 100;

const FILTER_PARAMS = [
  ["q", "q"],
  ["company", "company"],
  ["location", "location"],
  ["city", "city"],
  ["country", "country"],
  ["posted", "posted"],
  ["department", "department"],
  ["level", "level"],
  ["sort", "sort"],
] as const satisfies readonly (readonly [string, keyof JobFilters])[];

export type JobSearchParams =
  | { ok: true; filters: JobFilters; page: PageOptions }
  | { ok: false; error: "invalid_posted" | "offset_too_large" | "param_too_long" };

interface ParamReader {
  get(name: string): string | null;
}

function parseIntParam(params: ParamReader, key: string): number | undefined {
  const value = Number.parseInt(params.get(key) ?? "", 10);
  return Number.isNaN(value) ? undefined : value;
}

export function parseJobSearchParams(params: ParamReader): JobSearchParams {
  const filters: JobFilters = {};
  for (const [param, field] of FILTER_PARAMS) {
    const value = params.get(param)?.trim();
    if (!value) continue;
    const maxLength = field === "q" ? MAX_QUERY_LENGTH : MAX_FILTER_LENGTH;
    if (value.length > maxLength) return { ok: false, error: "param_too_long" };
    filters[field] = value;
  }

  if (filters.posted && !(POSTED_WINDOWS as string[]).includes(filters.posted)) {
    return { ok: false, error: "invalid_posted" };
  }

  const page: PageOptions = {};
  const limit = parseIntParam(params, "limit");
  const offset = parseIntParam(params, "offset");
  if (limit !== undefined) page.limit = limit;
  if (offset !== undefined) page.offset = offset;
  if ((offset ?? 0) > MAX_OFFSET) return { ok: false, error: "offset_too_large" };

  return { ok: true, filters, page };
}

export const HOME_FILTER_KEYS = [
  "q",
  "company",
  "location",
  "level",
  "department",
  "sort",
] as const;

export type HomeFilterKey = (typeof HOME_FILTER_KEYS)[number];
export type HomeFilters = Record<HomeFilterKey, string>;

export const EMPTY_HOME_FILTERS = Object.fromEntries(
  HOME_FILTER_KEYS.map((key) => [key, ""]),
) as HomeFilters;

// No sort means best match while searching and newest otherwise; "newest" is
// written only to override best match.
const SORT_OPTIONS: readonly string[] = ["newest", "company"];

function isValidHomeValue(key: HomeFilterKey, value: string): boolean {
  if (value.length > (key === "q" ? MAX_QUERY_LENGTH : MAX_FILTER_LENGTH)) return false;
  if (key === "level") return (LEVELS as readonly string[]).includes(value);
  if (key === "sort") return SORT_OPTIONS.includes(value);
  return true;
}

/**
 * Reads each filter on its own, so one bad value in a shared or stale link
 * drops only itself instead of every filter on the page.
 */
export function parseHomeFilters(params: ParamReader): HomeFilters {
  const filters = { ...EMPTY_HOME_FILTERS };
  for (const key of HOME_FILTER_KEYS) {
    const value = params.get(key)?.trim() ?? "";
    if (value && isValidHomeValue(key, value)) filters[key] = value;
  }
  return filters;
}

export function toQueryString(filters: HomeFilters): `?${string}` {
  const params = new URLSearchParams();
  for (const key of HOME_FILTER_KEYS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return `?${params}`;
}

export function toJobFilters(filters: HomeFilters): JobFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
}

// Sort is a view preference, not a filter, so clearing keeps it.
export function clearedFilters(filters: HomeFilters): HomeFilters {
  return { ...EMPTY_HOME_FILTERS, sort: filters.sort };
}

export function hasActiveFilters(filters: HomeFilters): boolean {
  return HOME_FILTER_KEYS.some((key) => key !== "sort" && filters[key] !== "");
}
