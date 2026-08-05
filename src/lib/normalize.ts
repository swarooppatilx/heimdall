export function normalizeLocation(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "unknown";

  const parts = trimmed
    .split(/\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = parts[0] ?? trimmed;
  const withoutLeadingRemote = first.replace(/^\s*remote\b[\s,\-—–:|]*/i, "").trim();
  if (!withoutLeadingRemote) return "remote";

  const segments = withoutLeadingRemote
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
