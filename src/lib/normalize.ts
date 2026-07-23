const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  uae: "United Arab Emirates",
  ksa: "Saudi Arabia",
  uk: "United Kingdom",
};

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normalizeCountry(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return COUNTRY_ALIASES[trimmed] ?? titleCase(trimmed);
}

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

export function regionFromLocation(raw: string): string {
  const withoutRemote = raw
    .trim()
    .replace(/^remote\s*[-—,.]?\s*/i, "")
    .replace(/,\s*remote\s*$/i, "");
  const parts = withoutRemote.split(/\s*,\s*/).filter(Boolean);
  const last = parts[parts.length - 1]?.trim();
  return last ? normalizeCountry(last).toLowerCase() : "";
}
