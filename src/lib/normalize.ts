export function normalizeLocation(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "unknown";

  const parts = trimmed
    .split(/\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = parts[0] ?? trimmed;

  if (/^remote\b/i.test(first)) return "remote";

  const segments = first
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^remote$/i.test(s));
  const deduped = segments.filter((s, i) =>
    i === 0 ? true : s.toLowerCase() !== (segments[i - 1] ?? "").toLowerCase(),
  );
  if (deduped.length === 0) return "unknown";
  return deduped.join(", ").toLowerCase();
}
