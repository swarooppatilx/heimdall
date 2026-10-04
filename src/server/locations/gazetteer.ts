import { fold } from "@/lib/fold";
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
} from "@/server/locations/gazetteer-data";

export interface Place {
  city?: string;
  country?: string;
  remote?: boolean;
}

// Segments are folded, so "München", "MUNCHEN" and "munchen" hit the same
// ASCII alias row and resolve to the same canonical place.
// A US ZIP code trails the state ("ma 01887", "nj 08109-1234"); it names no
// place of its own, so it goes before the state is looked up.
const TRAILING_ZIP = /\s+\d{5}(?:-\d{4})?$/;

function cleanSegment(segment: string): string {
  return fold(segment)
    .replace(TRAILING_ZIP, "")
    .replace(/^[-–—()\s]+|[-–—()\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

const fuzzyRegexCache = Object.entries(CITY_ALIASES)
  .filter(([alias]) => alias.length >= MIN_ALIAS_LENGTH)
  .map(([alias, place]) => ({
    alias,
    place: [place[0], place[1]] as [string, string],
    pattern: new RegExp(`\\b${escapeRegExp(alias)}\\b`),
  }))
  .sort((a, b) => b.alias.length - a.alias.length);

function fuzzyCity(text: string): [string, string] | undefined {
  for (const { place, pattern } of fuzzyRegexCache) {
    if (pattern.test(text)) return place;
  }
  return undefined;
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
  const fuzzy = fuzzyCity(fold(trimmed));
  return fuzzy ? { city: fuzzy[0], country: fuzzy[1] } : null;
}

function resolveRemote(segments: string[]): Place {
  // Re-clean after stripping so "us (remote)" leaves "us", not "us (".
  const stripped = segments
    .map((segment) => cleanSegment(segment.replace(REMOTE_PATTERN, " ")))
    .filter(Boolean);
  const remoteCountry = resolveExplicitCountry(stripped);
  return remoteCountry ? { remote: true, country: remoteCountry.toLowerCase() } : { remote: true };
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

const PLACE_CACHE_MAX = 2000;
const placeCache = new Map<string, Place | null>();

export function resolvePlace(raw: string): Place | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const key = fold(trimmed);
  const cached = placeCache.get(key);
  if (cached !== undefined) return cached;

  if (placeCache.size >= PLACE_CACHE_MAX) placeCache.clear();
  const place = resolveUncached(trimmed);
  placeCache.set(key, place);
  return place;
}

// "us-ca-menlo park" is the state-prefixed form some ATSes use for US offices;
// reading it as "menlo park, ca" lets the usual city and state lookups apply.
function withoutUsPrefix(text: string): string {
  const match = /^us-([a-z]{2})-(.+)$/.exec(text);
  return match ? `${match[2]}, ${match[1]}` : text;
}

function resolveUncached(trimmed: string): Place | null {
  if (/^\d+\s+locations?$/i.test(trimmed) || GARBAGE_PATTERN.test(trimmed)) return null;

  const street = resolveStreetAddress(trimmed);
  if (street) return street;

  const lowered = withoutUsPrefix(fold(trimmed));
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

/**
 * A posting's raw location text split into offices, the first being the
 * primary. Providers pass text through untouched; `resolvePlace` canonicalizes
 * it once at ingest, so signals like "Remote" survive until it reads them.
 */
export function postingLocations(raw: string): { location: string; locations: string[] } {
  const locations = splitLocations(raw);
  return { location: locations[0] ?? "", locations };
}

// Separates offices in a multi-location posting. A slash only counts with
// spaces around it ("Berlin / Munich"); "Remote/US" is one location.
export function splitLocations(raw: string): string[] {
  return raw
    .split(/\s*[;•|]\s*|\s+\/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
