import {
  CA_PROVINCES,
  CITY_ALIASES,
  CITY_COUNTRY_OVERRIDES,
  COUNTRIES,
  COUNTRY_CANONICAL,
  GARBAGE_PATTERN,
  NOISE_CHARS,
  REMOTE_PATTERN,
  SEGMENT_SPLIT,
  STREET_PATTERN,
  US_STATES,
} from "@/lib/gazetteer-data";

export interface Place {
  city?: string;
  country?: string;
  remote?: boolean;
}

function cleanSegment(segment: string): string {
  return segment
    .replace(/^[-–—()\s]+|[-–—()\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function lookupCountry(token: string): string | undefined {
  return COUNTRY_CANONICAL[token] ?? (COUNTRIES.has(token) ? token : undefined);
}

function lookupRegionState(token: string): string | undefined {
  return US_STATES[token] ?? CA_PROVINCES[token];
}

function lookupCity(token: string): [string, string] | undefined {
  return CITY_ALIASES[token];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MIN_ALIAS_LENGTH = 5;

function fuzzyCity(text: string): [string, string] | undefined {
  let bestAlias = "";
  let bestMatch: [string, string] | undefined;
  for (const [alias, place] of Object.entries(CITY_ALIASES)) {
    if (alias.length < MIN_ALIAS_LENGTH || alias.length <= bestAlias.length) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`);
    if (pattern.test(text)) {
      bestAlias = alias;
      bestMatch = [place[0], place[1]];
    }
  }
  return bestMatch;
}

function resolveExplicitCountry(segments: string[]): string | undefined {
  for (const segment of [...segments].reverse()) {
    const country = lookupCountry(segment);
    if (country) return country;
  }
  for (const segment of segments) {
    const state = lookupRegionState(segment);
    if (state) return state;
  }
  return undefined;
}

function resolveStreetAddress(trimmed: string): Place | null {
  if (!STREET_PATTERN.test(trimmed) || lookupCity(cleanSegment(trimmed))) return null;
  const fuzzy = fuzzyCity(trimmed.toLowerCase());
  return fuzzy ? { city: fuzzy[0], country: fuzzy[1] } : null;
}

function resolveRemote(segments: string[]): Place {
  const stripped = segments
    .map((segment) => segment.replace(REMOTE_PATTERN, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const remoteCountry = resolveExplicitCountry(stripped);
  return remoteCountry ? { remote: true, country: remoteCountry } : { remote: true };
}

function resolveCityFromSegments(
  segments: string[],
  country: string | undefined,
): { city: string; country: string | undefined } {
  let resolvedCity: string | undefined;
  let resolvedCountry = country;

  for (const segment of segments) {
    const hit = lookupCity(segment);
    if (!hit) continue;
    const explicit = resolvedCountry?.toLowerCase();
    const override = explicit ? CITY_COUNTRY_OVERRIDES[segment]?.[explicit] : undefined;
    if (override) {
      resolvedCity = override.toLowerCase();
      resolvedCountry = explicit;
      break;
    }
    if (explicit && explicit !== hit[1].toLowerCase() && CITY_COUNTRY_OVERRIDES[segment]) {
      continue;
    }
    resolvedCity = hit[0];
    resolvedCountry = resolvedCountry ?? hit[1];
    break;
  }

  return { city: resolvedCity ?? "", country: resolvedCountry };
}

export function resolvePlace(raw: string): Place | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d+\s+locations?$/i.test(trimmed) || GARBAGE_PATTERN.test(trimmed)) return null;

  const street = resolveStreetAddress(trimmed);
  if (street) return street;

  const lowered = trimmed.toLowerCase();
  const segments = lowered
    .split(SEGMENT_SPLIT)
    .map(cleanSegment)
    .filter((s) => s.length > 0 && !NOISE_CHARS.test(s));

  if (segments.some((s) => REMOTE_PATTERN.test(s))) return resolveRemote(segments);

  const country = resolveExplicitCountry(segments);
  const { city, country: finalCountry } = resolveCityFromSegments(segments, country);

  if (!(city || finalCountry)) {
    const fuzzy = fuzzyCity(lowered);
    if (fuzzy) {
      return { city: fuzzy[0].toLowerCase(), country: fuzzy[1].toLowerCase() };
    }
    return null;
  }

  return {
    ...(city ? { city: city.toLowerCase() } : {}),
    ...(finalCountry ? { country: finalCountry.toLowerCase() } : {}),
  };
}

export function formatPlace(place: Place): string {
  if (place.remote) {
    return place.country ? `remote, ${place.country}` : "remote";
  }
  if (place.city && place.country) return `${place.city}, ${place.country}`;
  if (place.city) return place.city;
  if (place.country) return place.country;
  return "unknown";
}

interface LocationCatalog {
  countries: string[];
  cities: { value: string; country: string }[];
}

export const LOCATION_CATALOG: LocationCatalog = {
  countries: [...new Set([...COUNTRIES, ...Object.values(COUNTRY_CANONICAL)])].sort(),
  cities: [
    ...new Map(
      Object.values(CITY_ALIASES).map(([city, country]) => [
        `${city.toLowerCase()}|${country.toLowerCase()}`,
        { value: city.toLowerCase(), country: country.toLowerCase() },
      ]),
    ).values(),
  ].sort((a, b) => a.value.localeCompare(b.value)),
};

export function splitLocations(raw: string): string[] {
  return raw
    .split(/\s*[;•|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}
