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
  if (!trimmed) return "Unknown";

  const parts = trimmed
    .split(/\s*;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = parts[0] ?? trimmed;

  const lower = first.toLowerCase();
  const isRemote = lower.startsWith("remote");

  if (isRemote) {
    const withoutRemote = first.replace(/^remote\s*[-,.\s]?\s*/i, "").trim();
    if (!withoutRemote) return "Remote";
    const countries = withoutRemote
      .split(/\s*,\s*/)
      .map((c) => normalizeCountry(c))
      .filter(Boolean);
    if (countries.length === 0) return "Remote";
    return `Remote — ${countries.join(", ")}`;
  }

  return first
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}
