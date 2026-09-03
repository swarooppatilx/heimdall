import { formatError, logEvent } from "@/lib/logger";

export function toCompanySlug(company: string): string {
  return encodeURIComponent(company);
}

export function fromCompanySlug(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch (err) {
    logEvent("invalid_company_slug", { slug: raw, error: formatError(err) });
    return "";
  }
}
