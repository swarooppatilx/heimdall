import { DAY_MS } from "@/modules/jobs/freshness";
import type { Job } from "@/modules/jobs/job";

export const DAYS_PER_WEEK = 7;
export const POSTED_WINDOWS_MS: Record<string, number> = {
  today: DAY_MS,
  week: DAYS_PER_WEEK * DAY_MS,
};

export type PostedWindow = "today" | "week";
export const POSTED_WINDOWS: PostedWindow[] = ["today", "week"];

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;

export interface JobFilters {
  q?: string;
  company?: string;
  location?: string;
  city?: string;
  country?: string;
  source?: string;
  experience?: string;
  posted?: string;
  department?: string;
  earlyCareer?: string;
  sort?: string;
}

export interface PageOptions {
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  jobs: Job[];
  total: number;
}
