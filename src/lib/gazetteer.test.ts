import { describe, expect, it } from "vitest";
import { formatPlace, resolvePlace } from "./gazetteer";

describe("resolvePlace", () => {
  const city = (raw: string) => {
    const place = resolvePlace(raw);
    return place ? { city: place.city, country: place.country } : null;
  };

  it("resolves city variants to one canonical place", () => {
    expect(city("bangalore")).toEqual({ city: "Bengaluru", country: "India" });
    expect(city("bengaluru")).toEqual({ city: "Bengaluru", country: "India" });
    expect(city("bengaluru, karnataka, india")).toEqual({
      city: "Bengaluru",
      country: "India",
    });
    expect(city("hsr layout, bangalore")).toEqual({ city: "Bengaluru", country: "India" });
    expect(city("bangalore - engineering")).toEqual({ city: "Bengaluru", country: "India" });
    expect(city("(bengaluru, india)")).toEqual({ city: "Bengaluru", country: "India" });
  });

  it("handles provider quirks from live data", () => {
    expect(city("us, ca, san jose, rio robles")).toEqual({
      city: "San Jose",
      country: "United States",
    });
    expect(city("bangalore, ind")).toEqual({ city: "Bengaluru", country: "India" });
    expect(city("hyderabad 04")).toEqual({ city: "Hyderabad", country: "India" });
    expect(city("singapore, sgp")).toEqual({ city: "Singapore", country: "Singapore" });
    expect(city("us-ga-atlanta")).toEqual({ city: "Atlanta", country: "United States" });
    expect(city("se-stockholm-mso")).toEqual({ city: "Stockholm", country: "Sweden" });
    expect(city("zürich, ch")).toEqual({ city: "Zurich", country: "Switzerland" });
  });

  it("falls back to state and country level", () => {
    expect(city("bellevue, wa")).toEqual({ city: "Bellevue", country: "United States" });
    expect(city("ca - sacramento")).toEqual({ city: "Sacramento", country: "United States" });
    expect(city("ontario, canada")).toEqual({ city: undefined, country: "Canada" });
    expect(city("germany")).toEqual({ city: undefined, country: "Germany" });
    expect(city("usa")).toEqual({ city: undefined, country: "United States" });
  });

  it("marks remote locations", () => {
    expect(resolvePlace("remote")).toEqual({ remote: true });
    expect(resolvePlace("remote - united states")).toEqual({ remote: true });
    expect(resolvePlace("us remote")).toEqual({ remote: true });
    expect(resolvePlace("work from home - emea")).toEqual({ remote: true });
    expect(resolvePlace("-remote, bulgaria-")).toEqual({ remote: true });
    expect(resolvePlace("distributed")).toEqual({ remote: true });
  });
  it("rejects garbage into unknown", () => {
    const garbage = [
      "n/a",
      "add all locations here",
      "blank, multiple locations",
      "location",
      "hybrid",
      "1122 broadway, eureka, california",
      "",
      "   ",
    ];
    for (const raw of garbage) {
      expect(resolvePlace(raw)).toBeNull();
    }
  });

  it("first recognized city wins for multi-office strings", () => {
    expect(city("bellevue, wa / livingston, nj / new york, ny")).toEqual({
      city: "Bellevue",
      country: "United States",
    });
    expect(city("london or dublin")).toEqual({ city: "London", country: "United Kingdom" });
  });

  it("formats canonical display strings", () => {
    expect(formatPlace({ city: "Bengaluru", country: "India" })).toBe("Bengaluru, India");
    expect(formatPlace({ country: "Germany" })).toBe("Germany");
    expect(formatPlace({ remote: true })).toBe("Remote");
  });
});
