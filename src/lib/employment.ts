export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;

const EMPLOYMENT_TYPES = {
  FULL_TIME: null,
  PART_TIME: null,
  CONTRACTOR: null,
  TEMPORARY: null,
  INTERN: null,
} as const;

const ALIASES: Record<EmploymentType, RegExp> = {
  FULL_TIME:
    /full[\s-]?time|fulltime|regular|permanent|\bfte\b|salaried|unlimited|backfill|^new$|employee/,
  PART_TIME: /part[\s-]?time|parttime/,
  CONTRACTOR: /\bcontract(?!ual term)\b|contractor|freelance|\bc2c\b|1099/,
  TEMPORARY: /temp(?:orary)?\b|fixed[- ]term|casual|seasonal/,
  INTERN: /intern|co-?op|working student|apprentice|trainee|graduate scheme/,
};

export function resolveEmploymentType(raw: string | undefined): EmploymentType | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  for (const [type, pattern] of Object.entries(ALIASES)) {
    if (pattern.test(value)) return type as EmploymentType;
  }
  return undefined;
}
