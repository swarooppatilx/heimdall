import { DEPARTMENTS } from "./department";
import { EMPLOYMENT_TYPES } from "./employment";
import { EXPERIENCE_LEVELS } from "./experience";
import { LOCATION_CATALOG } from "./gazetteer";

export const FILTER_SOURCES = [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workday",
] as const;

export const FILTER_DEPARTMENTS: readonly string[] = DEPARTMENTS;
export const FILTER_EXPERIENCE_LEVELS: readonly string[] = EXPERIENCE_LEVELS;
export const FILTER_EMPLOYMENT_TYPES: readonly string[] = EMPLOYMENT_TYPES;
export const FILTER_LOCATIONS = LOCATION_CATALOG;
