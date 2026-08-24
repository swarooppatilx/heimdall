export function toCompanySlug(company: string): string {
  return encodeURIComponent(company);
}

export function fromCompanySlug(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return "";
  }
}
