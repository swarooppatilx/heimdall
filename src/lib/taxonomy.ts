import { EXPERIENCE_LEVELS } from "@/lib/experience";
import registry from "@/server/crawl/registry.json";
import { DEPARTMENTS } from "@/server/jobs/department";
import { sanitizeFilterValue } from "@/server/jobs/sanitize";
import { LOCATION_CATALOG } from "@/server/locations/gazetteer";

export const FILTER_SOURCES = [
  ...new Set(registry.map((entry) => entry.provider)),
].sort() as string[];

export const FILTER_COMPANIES: readonly string[] = [
  ...new Set(registry.map((entry) => sanitizeFilterValue(entry.label ?? entry.name))),
].sort();

export const FILTER_DEPARTMENTS: readonly string[] = DEPARTMENTS;
export const FILTER_EXPERIENCE_LEVELS: readonly string[] = EXPERIENCE_LEVELS;
export const FILTER_LOCATIONS = LOCATION_CATALOG;
