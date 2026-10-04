import { describe, expect, it } from "vitest";
import { fold } from "@/lib/fold";
import { formatPlace, resolvePlace, splitLocations } from "@/server/locations/gazetteer";
import { CITY_ALIASES } from "@/server/locations/gazetteer-data";

describe("resolvePlace", () => {
  const city = (raw: string) => {
    const place = resolvePlace(raw);
    return place ? { city: place.city, country: place.country } : null;
  };

  it("resolves city variants to one canonical place", () => {
    expect(city("bangalore")).toEqual({ city: "bengaluru", country: "india" });
    expect(city("bengaluru")).toEqual({ city: "bengaluru", country: "india" });
    expect(city("bengaluru, karnataka, india")).toEqual({
      city: "bengaluru",
      country: "india",
    });
    expect(city("hsr layout, bangalore")).toEqual({ city: "bengaluru", country: "india" });
    expect(city("bangalore - engineering")).toEqual({ city: "bengaluru", country: "india" });
    expect(city("(bengaluru, india)")).toEqual({ city: "bengaluru", country: "india" });
  });

  it("handles provider quirks from live data", () => {
    expect(city("us, ca, san jose, rio robles")).toEqual({
      city: "san jose",
      country: "united states",
    });
    expect(city("bangalore, ind")).toEqual({ city: "bengaluru", country: "india" });
    expect(city("hyderabad 04")).toEqual({ city: "hyderabad", country: "india" });
    expect(city("singapore, sgp")).toEqual({ city: "singapore", country: "singapore" });
    expect(city("us-ga-atlanta")).toEqual({ city: "atlanta", country: "united states" });
    expect(city("se-stockholm-mso")).toEqual({ city: "stockholm", country: "sweden" });
    expect(city("zürich, ch")).toEqual({ city: "zurich", country: "switzerland" });
  });

  it("falls back to state and country level", () => {
    expect(city("bellevue, wa")).toEqual({ city: "bellevue", country: "united states" });
    expect(city("ca - sacramento")).toEqual({ city: "sacramento", country: "united states" });
    expect(city("ontario, canada")).toEqual({ city: undefined, country: "canada" });
    expect(city("germany")).toEqual({ city: undefined, country: "germany" });
    expect(city("usa")).toEqual({ city: undefined, country: "united states" });
  });

  it("marks remote locations", () => {
    expect(resolvePlace("remote")).toEqual({ remote: true });
    expect(resolvePlace("us remote")).toEqual({ remote: true, country: "united states" });
    expect(resolvePlace("work from home - emea")).toEqual({ remote: true });
    expect(resolvePlace("-remote, bulgaria-")).toEqual({ remote: true, country: "bulgaria" });
    expect(resolvePlace("distributed")).toEqual({ remote: true });
  });

  it("keeps the city when an explicit country matches a known override", () => {
    expect(resolvePlace("Cambridge, United Kingdom")).toEqual({
      city: "cambridge",
      country: "united kingdom",
    });
    expect(resolvePlace("Reading, PA")).toEqual({ city: "reading", country: "united states" });
    expect(resolvePlace("Baton Rouge, LA")).toEqual({
      city: "baton rouge",
      country: "united states",
    });
  });
  it("rejects garbage into unknown", () => {
    const garbage = [
      "n/a",
      "add all locations here",
      "blank, multiple locations",
      "location",
      "hybrid",
      "",
      "   ",
    ];
    for (const raw of garbage) {
      expect(resolvePlace(raw)).toBeNull();
    }
  });

  it("first recognized city wins for multi-office strings", () => {
    expect(city("bellevue, wa / livingston, nj / new york, ny")).toEqual({
      city: "bellevue",
      country: "united states",
    });
    expect(city("london or dublin")).toEqual({ city: "london", country: "united kingdom" });
  });

  it("formats canonical display strings", () => {
    expect(formatPlace({ city: "bengaluru", country: "india" })).toBe("bengaluru, india");
    expect(formatPlace({ country: "germany" })).toBe("germany");
    expect(formatPlace({ remote: true })).toBe("remote");
  });
});

describe("postal codes and bare state names from live data", () => {
  const where = (raw: string) => {
    const place = resolvePlace(raw);
    return place ? { city: place.city, country: place.country } : null;
  };

  it("reads a US address with a ZIP code as its state", () => {
    expect(where("Wilmington, MA 01887")).toEqual({ country: "united states" });
    expect(where("Pennsauken, NJ 08109-1234")).toEqual({ country: "united states" });
  });

  it("keeps a known city when a ZIP follows the state", () => {
    expect(where("Austin, TX 78701")).toEqual({ city: "austin", country: "united states" });
  });

  it("reads a bare US state name as the United States", () => {
    expect(where("California")).toEqual({ country: "united states" });
    expect(where("Jackson, Mississippi")).toEqual({ country: "united states" });
    expect(where("Washington, D.C.")).toEqual({ country: "united states" });
  });

  it("leaves Georgia alone, since it is as often the country", () => {
    expect(where("Georgia")).toBeNull();
  });

  it("reads the us-state-city prefix form, keeping a city only when it is a known one", () => {
    expect(where("US-CA-Menlo Park")).toEqual({ country: "united states" });
    expect(where("US-TX-Austin")).toEqual({ city: "austin", country: "united states" });
  });

  it("resolves a street address in a named state to the country", () => {
    expect(where("1122 Broadway, Eureka, California")).toEqual({ country: "united states" });
  });

  it("reads native-language names", () => {
    expect(where("Brasil")).toEqual({ country: "brazil" });
    expect(where("Ciudad de México")).toEqual({ city: "mexico city", country: "mexico" });
  });

  it("keeps the country lower-case when a remote role names only a state", () => {
    expect(resolvePlace("California - remote")).toEqual({ remote: true, country: "united states" });
    expect(resolvePlace("Remote, TX")).toEqual({ remote: true, country: "united states" });
  });

  it("files US towns that share a name with a UK or Australian city under the US", () => {
    expect(where("Reading, PA 19601")).toEqual({ city: "reading", country: "united states" });
    expect(where("Perth Amboy, NJ 08861")).toEqual({ country: "united states" });
  });

  it("does not treat a number that isn't a ZIP as one", () => {
    expect(where("Building 12345 Campus")).toBeNull();
  });
});

describe("filter matching contract", () => {
  it("collapses location aliases to canonical countries", () => {
    expect(resolvePlace("usa")?.country).toBe("united states");
    expect(resolvePlace("us")?.country).toBe("united states");
    expect(resolvePlace("United States")?.country).toBe("united states");
  });

  it("resolves city and country from combined location strings", () => {
    const place = resolvePlace("san francisco, united states");
    expect(place?.city).toBe("san francisco");
    expect(place?.country).toBe("united states");
  });

  it("marks remote variants", () => {
    expect(resolvePlace("Remote — United States")?.remote).toBe(true);
  });
});

describe("folding and data policy", () => {
  it("resolves accented and upper-case spellings to the same place", () => {
    const munich = { city: "munich", country: "germany" };
    expect(resolvePlace("München")).toEqual(munich);
    expect(resolvePlace("MUNCHEN")).toEqual(munich);
    expect(resolvePlace("São Paulo")).toEqual({ city: "sao paulo", country: "brazil" });
  });

  it("keeps every alias key in folded form so lookups can't miss on accents", () => {
    for (const alias of Object.keys(CITY_ALIASES)) expect(fold(alias)).toBe(alias);
  });

  it("does not treat a 'distributed systems' job as remote", () => {
    expect(resolvePlace("Distributed Systems, Berlin")).toEqual({
      city: "berlin",
      country: "germany",
    });
  });

  it("still recognises remote wherever the word appears", () => {
    expect(resolvePlace("US (Remote)")).toEqual({ remote: true, country: "united states" });
    expect(resolvePlace("Anywhere in the US")?.remote).toBe(true);
    expect(resolvePlace("Distributed")).toEqual({ remote: true });
  });

  it("has one canonical name per country", () => {
    expect(resolvePlace("Czech Republic")).toEqual({ country: "czechia" });
    expect(resolvePlace("Croatia")).toEqual({ country: "croatia" });
    expect(resolvePlace("Zagreb")).toEqual({ city: "zagreb", country: "croatia" });
  });

  it("reads bare 'korea' as South Korea and never invents North Korea", () => {
    expect(resolvePlace("Korea")).toEqual({ country: "south korea" });
    expect(resolvePlace("North Korea")).toBeNull();
  });

  it("splits offices on a spaced slash but keeps 'Remote/US' as one location", () => {
    expect(splitLocations("Berlin / Munich")).toEqual(["Berlin", "Munich"]);
    expect(splitLocations("Remote/US")).toEqual(["Remote/US"]);
  });
});
