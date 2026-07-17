export const EXPERIENCE_LEVELS = ["intern", "entry", "mid", "senior", "staff"] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

const PATTERNS: { level: ExperienceLevel; regex: RegExp }[] = [
  { level: "intern", regex: /\bintern(?:ship)?\b/i },
  {
    level: "entry",
    regex: /\b(?:junior|jr\.?|associate|entry[ -]level|new[ -]grad(?:uate)?|graduate|trainee)\b/i,
  },
  {
    level: "staff",
    regex: /\b(?:staff|principal|distinguished|fellow)\b/i,
  },
  {
    level: "senior",
    regex: /\b(?:senior|sr\.?|lead|director|vp|vice[ -]president|head[ -]of|chief)\b/i,
  },
];

export function detectExperienceLevel(title: string): ExperienceLevel {
  for (const { level, regex } of PATTERNS) {
    if (regex.test(title)) return level;
  }
  return "mid";
}
