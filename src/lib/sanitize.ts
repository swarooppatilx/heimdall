export function sanitizeFilterValue(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/[_\u2013\u2014-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
