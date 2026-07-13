export const EMPLOYMENT_TYPES = [
  "full time",
  "part time",
  "contractor",
  "temporary",
  "intern",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const ALIASES: Record<EmploymentType, RegExp> = {
  "full time":
    /full[\s-]?time|fulltime|regular|permanent|\bfte\b|salaried|unlimited|backfill|^new$|employee/,
  "part time": /part[\s-]?time|parttime/,
  contractor: /\bcontract(?!ual term)\b|contractor|freelance|\bc2c\b|1099/,
  temporary: /temp(?:orary)?\b|fixed[- ]term|casual|seasonal/,
  intern: /intern|co-?op|working student|apprentice|trainee|graduate scheme/,
};

const TOKENS = new Set<string>(EMPLOYMENT_TYPES);

export function resolveEmploymentType(raw: string | undefined): EmploymentType | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  if (TOKENS.has(value)) return value as EmploymentType;
  for (const [type, pattern] of Object.entries(ALIASES)) {
    if (pattern.test(value)) return type as EmploymentType;
  }
  return undefined;
}
