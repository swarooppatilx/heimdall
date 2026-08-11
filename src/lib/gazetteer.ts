export interface Place {
  city?: string;
  country?: string;
  remote?: boolean;
}

const COUNTRY_CANONICAL: Record<string, string> = {
  korea: "south korea",
  usa: "united states",
  "u.s.": "united states",
  us: "united states",
  "united states of america": "united states",
  america: "united states",
  uk: "united kingdom",
  "great britain": "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",
  wales: "united kingdom",
  "u.a.e": "united arab emirates",
  uae: "united arab emirates",
  emirates: "united arab emirates",
  india: "india",
  bharat: "india",
  canada: "canada",
  deutschland: "germany",
};

const COUNTRIES = new Set([
  "argentina",
  "australia",
  "austria",
  "belgium",
  "brazil",
  "bulgaria",
  "chile",
  "china",
  "colombia",
  "czechia",
  "czech republic",
  "denmark",
  "egypt",
  "estonia",
  "finland",
  "france",
  "germany",
  "greece",
  "hong kong",
  "hungary",
  "iceland",
  "indonesia",
  "ireland",
  "israel",
  "italy",
  "japan",
  "kenya",
  "latvia",
  "lithuania",
  "malaysia",
  "malta",
  "mexico",
  "morocco",
  "netherlands",
  "new zealand",
  "nigeria",
  "norway",
  "peru",
  "philippines",
  "poland",
  "portugal",
  "qatar",
  "romania",
  "saudi arabia",
  "serbia",
  "singapore",
  "slovakia",
  "slovenia",
  "south africa",
  "south korea",
  "spain",
  "sweden",
  "switzerland",
  "taiwan",
  "thailand",
  "turkey",
  "united arab emirates",
  "united kingdom",
  "united states",
  "vietnam",
]);

const CITY_ALIASES: Record<string, [string, string]> = {
  bangalore: ["Bengaluru", "India"],
  bengaluru: ["Bengaluru", "India"],
  hsr: ["Bengaluru", "India"],
  "hsr layout": ["Bengaluru", "India"],
  koramangala: ["Bengaluru", "India"],
  whitefield: ["Bengaluru", "India"],
  "electronic city": ["Bengaluru", "India"],
  indiranagar: ["Bengaluru", "India"],
  bellandur: ["Bengaluru", "India"],
  hebbal: ["Bengaluru", "India"],
  devanahalli: ["Bengaluru", "India"],
  hyderabad: ["Hyderabad", "India"],
  secunderabad: ["Hyderabad", "India"],
  gachibowli: ["Hyderabad", "India"],
  hitec: ["Hyderabad", "India"],
  madhapur: ["Hyderabad", "India"],
  chennai: ["Chennai", "India"],
  coimbatore: ["Coimbatore", "India"],
  pune: ["Pune", "India"],
  mumbai: ["Mumbai", "India"],
  "navi mumbai": ["Mumbai", "India"],
  thane: ["Mumbai", "India"],
  gurgaon: ["Gurugram", "India"],
  gurugram: ["Gurugram", "India"],
  noida: ["Noida", "India"],
  delhi: ["Delhi", "India"],
  "new delhi": ["Delhi", "India"],
  faridabad: ["Delhi", "India"],
  ghaziabad: ["Delhi", "India"],
  kolkata: ["Kolkata", "India"],
  ahmedabad: ["Ahmedabad", "India"],
  jaipur: ["Jaipur", "India"],
  indore: ["Indore", "India"],
  kochi: ["Kochi", "India"],
  cochin: ["Kochi", "India"],
  chandigarh: ["Chandigarh", "India"],
  mohali: ["Chandigarh", "India"],
  bhubaneswar: ["Bhubaneswar", "India"],
  nagpur: ["Nagpur", "India"],
  trivandrum: ["Thiruvananthapuram", "India"],
  thiruvananthapuram: ["Thiruvananthapuram", "India"],
  visakhapatnam: ["Visakhapatnam", "India"],
  "san francisco": ["San Francisco", "United States"],
  sf: ["San Francisco", "United States"],
  "bay area": ["San Francisco", "United States"],
  "silicon valley": ["San Francisco", "United States"],
  "san jose": ["San Jose", "United States"],
  "rio robles": ["San Jose", "United States"],
  "santa clara": ["Santa Clara", "United States"],
  sunnyvale: ["Sunnyvale", "United States"],
  "mountain view": ["Mountain View", "United States"],
  "palo alto": ["Palo Alto", "United States"],
  "redwood city": ["Redwood City", "United States"],
  "san mateo": ["San Mateo", "United States"],
  oakland: ["Oakland", "United States"],
  berkeley: ["Berkeley", "United States"],
  fremont: ["Fremont", "United States"],
  "los angeles": ["Los Angeles", "United States"],
  "baton rouge": ["Baton Rouge", "United States"],
  "santa monica": ["Los Angeles", "United States"],
  sandiego: ["San Diego", "United States"],
  "san diego": ["San Diego", "United States"],
  irvine: ["Irvine", "United States"],
  sacramento: ["Sacramento", "United States"],
  seattle: ["Seattle", "United States"],
  bellevue: ["Bellevue", "United States"],
  redmond: ["Redmond", "United States"],
  portland: ["Portland", "United States"],
  denver: ["Denver", "United States"],
  boulder: ["Denver", "United States"],
  austin: ["Austin", "United States"],
  dallas: ["Dallas", "United States"],
  houston: ["Houston", "United States"],
  "salt lake city": ["Salt Lake City", "United States"],
  lehi: ["Salt Lake City", "United States"],
  "cottonwood heights": ["Salt Lake City", "United States"],
  chicago: ["Chicago", "United States"],
  boston: ["Boston", "United States"],
  cambridge: ["Cambridge", "United States"],
  "new york": ["New York", "United States"],
  nyc: ["New York", "United States"],
  atlanta: ["Atlanta", "United States"],
  miami: ["Miami", "United States"],
  orlando: ["Orlando", "United States"],
  tampa: ["Tampa", "United States"],
  charlotte: ["Charlotte", "United States"],
  raleigh: ["Raleigh", "United States"],
  durham: ["Raleigh", "United States"],
  nashville: ["Nashville", "United States"],
  memphis: ["Memphis", "United States"],
  "st louis": ["St Louis", "United States"],
  minneapolis: ["Minneapolis", "United States"],
  "kansas city": ["Kansas City", "United States"],
  cincinnati: ["Cincinnati", "United States"],
  cleveland: ["Cleveland", "United States"],
  columbus: ["Columbus", "United States"],
  indianapolis: ["Indianapolis", "United States"],
  detroit: ["Detroit", "United States"],
  milwaukee: ["Milwaukee", "United States"],
  madison: ["Madison", "United States"],
  philadelphia: ["Philadelphia", "United States"],
  pittsburgh: ["Pittsburgh", "United States"],
  phoenix: ["Phoenix", "United States"],
  mesa: ["Phoenix", "United States"],
  "ann arbor": ["Ann Arbor", "United States"],
  huntsville: ["Huntsville", "United States"],
  toronto: ["Toronto", "Canada"],
  vancouver: ["Vancouver", "Canada"],
  montreal: ["Montreal", "Canada"],
  ottawa: ["Ottawa", "Canada"],
  calgary: ["Calgary", "Canada"],
  edmonton: ["Edmonton", "Canada"],
  waterloo: ["Waterloo", "Canada"],
  kitchener: ["Waterloo", "Canada"],
  london: ["London", "United Kingdom"],
  manchester: ["Manchester", "United Kingdom"],
  bristol: ["Bristol", "United Kingdom"],
  edinburgh: ["Edinburgh", "United Kingdom"],
  reading: ["Reading", "United Kingdom"],
  bracknell: ["Reading", "United Kingdom"],
  dublin: ["Dublin", "Ireland"],
  cork: ["Cork", "Ireland"],
  limerick: ["Limerick", "Ireland"],
  amsterdam: ["Amsterdam", "Netherlands"],
  rotterdam: ["Rotterdam", "Netherlands"],
  eindhoven: ["Eindhoven", "Netherlands"],
  berlin: ["Berlin", "Germany"],
  munich: ["Munich", "Germany"],
  munchen: ["Munich", "Germany"],
  hamburg: ["Hamburg", "Germany"],
  frankfurt: ["Frankfurt", "Germany"],
  freiburg: ["Freiburg", "Germany"],
  paris: ["Paris", "France"],
  bordeaux: ["Bordeaux", "France"],
  meylan: ["Grenoble", "France"],
  zurich: ["Zurich", "Switzerland"],
  zürich: ["Zurich", "Switzerland"],
  geneva: ["Geneva", "Switzerland"],
  basel: ["Basel", "Switzerland"],
  vienna: ["Vienna", "Austria"],
  wien: ["Vienna", "Austria"],
  stockholm: ["Stockholm", "Sweden"],
  malmo: ["Malmo", "Sweden"],
  malmö: ["Malmo", "Sweden"],
  copenhagen: ["Copenhagen", "Denmark"],
  oslo: ["Oslo", "Norway"],
  helsinki: ["Helsinki", "Finland"],
  warsaw: ["Warsaw", "Poland"],
  krakow: ["Krakow", "Poland"],
  kraków: ["Krakow", "Poland"],
  wroclaw: ["Wroclaw", "Poland"],
  wrocław: ["Wroclaw", "Poland"],
  gdansk: ["Gdansk", "Poland"],
  prague: ["Prague", "Czechia"],
  brno: ["Brno", "Czechia"],
  budapest: ["Budapest", "Hungary"],
  bucharest: ["Bucharest", "Romania"],
  sofia: ["Sofia", "Bulgaria"],
  bratislava: ["Bratislava", "Slovakia"],
  belgrade: ["Belgrade", "Serbia"],
  "novi sad": ["Belgrade", "Serbia"],
  zagreb: ["Zagreb", "Croatia"],
  lisbon: ["Lisbon", "Portugal"],
  lisboa: ["Lisbon", "Portugal"],
  porto: ["Porto", "Portugal"],
  madrid: ["Madrid", "Spain"],
  barcelona: ["Barcelona", "Spain"],
  malaga: ["Malaga", "Spain"],
  milan: ["Milan", "Italy"],
  milano: ["Milan", "Italy"],
  rome: ["Rome", "Italy"],
  roma: ["Rome", "Italy"],
  tallinn: ["Tallinn", "Estonia"],
  riga: ["Riga", "Latvia"],
  vilnius: ["Vilnius", "Lithuania"],
  valletta: ["Malta", "Malta"],
  brussels: ["Brussels", "Belgium"],
  antwerp: ["Antwerp", "Belgium"],
  istanbul: ["Istanbul", "Turkey"],
  singapore: ["Singapore", "Singapore"],
  "hong kong": ["Hong Kong", "Hong Kong"],
  tokyo: ["Tokyo", "Japan"],
  osaka: ["Osaka", "Japan"],
  yokohama: ["Yokohama", "Japan"],
  fukuoka: ["Fukuoka", "Japan"],
  seoul: ["Seoul", "South Korea"],
  taipei: ["Taipei", "Taiwan"],
  hsinchu: ["Hsinchu", "Taiwan"],
  zhubei: ["Hsinchu", "Taiwan"],
  beijing: ["Beijing", "China"],
  shanghai: ["Shanghai", "China"],
  shenzhen: ["Shenzhen", "China"],
  hangzhou: ["Hangzhou", "China"],
  suzhou: ["Suzhou", "China"],
  dalian: ["Dalian", "China"],
  qingdao: ["Qingdao", "China"],
  jakarta: ["Jakarta", "Indonesia"],
  bangkok: ["Bangkok", "Thailand"],
  "ho chi minh city": ["Ho Chi Minh City", "Vietnam"],
  hanoi: ["Hanoi", "Vietnam"],
  manila: ["Manila", "Philippines"],
  alabang: ["Manila", "Philippines"],
  "kuala lumpur": ["Kuala Lumpur", "Malaysia"],
  penang: ["Penang", "Malaysia"],
  sydney: ["Sydney", "Australia"],
  melbourne: ["Melbourne", "Australia"],
  brisbane: ["Brisbane", "Australia"],
  perth: ["Perth", "Australia"],
  canberra: ["Canberra", "Australia"],
  auckland: ["Auckland", "New Zealand"],
  wellington: ["Wellington", "New Zealand"],
  "sao paulo": ["Sao Paulo", "Brazil"],
  "são paulo": ["Sao Paulo", "Brazil"],
  "porto alegre": ["Porto Alegre", "Brazil"],
  "belo horizonte": ["Belo Horizonte", "Brazil"],
  "buenos aires": ["Buenos Aires", "Argentina"],
  santiago: ["Santiago", "Chile"],
  bogota: ["Bogota", "Colombia"],
  bogotá: ["Bogota", "Colombia"],
  lima: ["Lima", "Peru"],
  "mexico city": ["Mexico City", "Mexico"],
  guadalajara: ["Guadalajara", "Mexico"],
  "tel aviv": ["Tel Aviv", "Israel"],
  netanya: ["Tel Aviv", "Israel"],
  haifa: ["Haifa", "Israel"],
  dubai: ["Dubai", "United Arab Emirates"],
  "abu dhabi": ["Abu Dhabi", "United Arab Emirates"],
  riyadh: ["Riyadh", "Saudi Arabia"],
  jeddah: ["Jeddah", "Saudi Arabia"],
  doha: ["Doha", "Qatar"],
  casablanca: ["Casablanca", "Morocco"],
  cairo: ["Cairo", "Egypt"],
  lagos: ["Lagos", "Nigeria"],
  nairobi: ["Nairobi", "Kenya"],
  johannesburg: ["Johannesburg", "South Africa"],
  "cape town": ["Cape Town", "South Africa"],
  reykjavik: ["Reykjavik", "Iceland"],
  reykjavík: ["Reykjavik", "Iceland"],
};

// Ambiguous city names whose alias default is wrong for some countries.
const CITY_COUNTRY_OVERRIDES: Record<string, Record<string, string>> = {
  cambridge: { "united kingdom": "Cambridge" },
  reading: { "united states": "Reading" },
};

const US_STATES: Record<string, string> = {
  al: "United States",
  ak: "United States",
  az: "United States",
  ar: "United States",
  ca: "United States",
  co: "United States",
  ct: "United States",
  de: "United States",
  fl: "United States",
  ga: "United States",
  hi: "United States",
  id: "United States",
  il: "United States",
  in: "United States",
  ia: "United States",
  ks: "United States",
  ky: "United States",
  la: "United States",
  me: "United States",
  md: "United States",
  ma: "United States",
  mi: "United States",
  mn: "United States",
  ms: "United States",
  mo: "United States",
  mt: "United States",
  ne: "United States",
  nv: "United States",
  nh: "United States",
  nj: "United States",
  nm: "United States",
  ny: "United States",
  nc: "United States",
  nd: "United States",
  oh: "United States",
  ok: "United States",
  or: "United States",
  pa: "United States",
  ri: "United States",
  sc: "United States",
  sd: "United States",
  tn: "United States",
  tx: "United States",
  ut: "United States",
  vt: "United States",
  va: "United States",
  wa: "United States",
  wv: "United States",
  wi: "United States",
  wy: "United States",
  dc: "United States",
};

const CA_PROVINCES: Record<string, string> = {
  ontario: "Canada",
  quebec: "Canada",
  alberta: "Canada",
  "british columbia": "Canada",
  manitoba: "Canada",
  saskatchewan: "Canada",
};

const REMOTE_PATTERN = /\b(remote|work from home|wfh|anywhere|distributed)\b/i;
const GARBAGE_PATTERN =
  /^(n\/?a|location|unknown|hybrid|onsite|on-site|in-office|in-pune|office|hq|headquarters?|global|multiple locations|\d+\s+locations?|blank.*|add all.*|various.*|not applicable)$/i;
const STREET_PATTERN = /^\d+\s+\w+/;

const SEGMENT_SPLIT = /[,/\u2022|;\u2014\u2013]+|\s+-\s+/;
const NOISE_CHARS = /^[\s\-().]*$/;

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
  let best: [string, string] | undefined;
  for (const [alias, place] of Object.entries(CITY_ALIASES)) {
    if (alias.length < MIN_ALIAS_LENGTH || alias.length <= bestAlias.length) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`);
    if (pattern.test(text)) {
      bestAlias = alias;
      best = [place[0], place[1]];
    }
  }
  return best;
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

export interface LocationCatalog {
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
