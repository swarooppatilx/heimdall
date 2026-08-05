import { describe, expect, it } from "vitest";
import { formatPlace, resolvePlace } from "@/lib/gazetteer";

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
