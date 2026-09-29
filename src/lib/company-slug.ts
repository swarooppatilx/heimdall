export function toCompanySlug(company: string): string {
  return encodeURIComponent(company);
}

// Generated slugs percent-encode everything, so a name with a real "+"
// ("disney+ hotstar" → disney%2B%20hotstar) round-trips. A bare "+" is read as
// a space for form-encoded and hand-typed links. Malformed percent-encoding
// comes from hand-edited URLs and resolves to no company.
export function fromCompanySlug(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return "";
  }
}
