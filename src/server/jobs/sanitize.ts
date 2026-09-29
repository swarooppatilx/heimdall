import { fromCompanySlug } from "@/lib/company-slug";

export function sanitizeFilterValue(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Company names are stored sanitized, so a hand-typed or title-cased
// `/company/Apple` has to be normalized before it can match.
export function companyFromSlug(slug: string): string {
  return sanitizeFilterValue(fromCompanySlug(slug));
}
