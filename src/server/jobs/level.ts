import { fold } from "@/lib/fold";
import type { Level } from "@/lib/level";

// Checked in order, highest first, so "Senior Staff Engineer" is lead and
// "Senior Recruiter, Early Careers" is senior. "Associate" and a trailing "I"
// are left out: in real titles they mark seniority as often as not
// ("Sr. Associate", "Associate Director", "Senior Software Engineer I").
const RULES: [RegExp, Level][] = [
  [/\b(?:staff|principal|distinguished|lead|director|head of|vp|vice president|chief)\b/, "lead"],
  [/\b(?:senior|sr)\b/, "senior"],
  [/\b(?:interns?|internship|co-?op|working student|werkstudent|apprentice(?:ship)?)\b/, "intern"],
  [/\b(?:new grad(?:uate)?|graduate|early careers?|junior|jr|entry[- ]level|trainee)\b/, "entry"],
];

export function detectLevel(title: string): Level {
  const text = fold(title);
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "mid";
}
