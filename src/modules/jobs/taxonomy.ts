import { sanitizeFilterValue } from "@/lib/sanitize";
import { LOCATION_CATALOG } from "@/modules/crawl/gazetteer";
import registry from "@/modules/crawl/registry.json";
import { DEPARTMENTS } from "@/modules/jobs/department";
import { EXPERIENCE_LEVELS } from "@/modules/jobs/experience";

export const FILTER_SOURCES = [
  ...new Set(registry.map((entry) => entry.provider)),
].sort() as string[];

export const FILTER_COMPANIES: readonly string[] = [
  ...new Set(registry.map((entry) => sanitizeFilterValue(entry.label ?? entry.name))),
].sort();

export const FILTER_DEPARTMENTS: readonly string[] = DEPARTMENTS;
export const FILTER_EXPERIENCE_LEVELS: readonly string[] = EXPERIENCE_LEVELS;
export const FILTER_LOCATIONS = LOCATION_CATALOG;
