import { DEPARTMENTS } from "@/lib/department";
import { EMPLOYMENT_TYPES } from "@/lib/employment";
import { EXPERIENCE_LEVELS } from "@/lib/experience";
import { LOCATION_CATALOG } from "@/lib/gazetteer";
import registry from "@/lib/registry.json";
import { sanitizeFilterValue } from "@/lib/sanitize";

export const FILTER_SOURCES = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
] as const;

export const FILTER_COMPANIES: readonly string[] = [
  ...new Set(registry.map((entry) => sanitizeFilterValue(entry.label ?? entry.name))),
].sort();

export const FILTER_DEPARTMENTS: readonly string[] = DEPARTMENTS;
export const FILTER_EXPERIENCE_LEVELS: readonly string[] = EXPERIENCE_LEVELS;
export const FILTER_EMPLOYMENT_TYPES: readonly string[] = EMPLOYMENT_TYPES;
export const FILTER_LOCATIONS = LOCATION_CATALOG;
