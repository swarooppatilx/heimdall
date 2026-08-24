import { describe, expect, it } from "vitest";
import { fromCompanySlug, toCompanySlug } from "@/lib/company-slug";

describe("company slug roundtrip", () => {
  it("percent-encodes spaces", () => {
    expect(toCompanySlug("four kites")).toBe("four%20kites");
    expect(toCompanySlug("sum up")).toBe("sum%20up");
    expect(toCompanySlug("rocket chat")).toBe("rocket%20chat");
  });

  it("leaves single-word companies unchanged", () => {
    expect(toCompanySlug("bell")).toBe("bell");
    expect(toCompanySlug("stripe")).toBe("stripe");
  });

  it("decodes percent-encoded spaces", () => {
    expect(fromCompanySlug("four%20kites")).toBe("four kites");
    expect(fromCompanySlug("sum%20up")).toBe("sum up");
  });

  it("decodes legacy plus encoding too", () => {
    expect(fromCompanySlug("four+kites")).toBe("four kites");
    expect(fromCompanySlug("sum+up")).toBe("sum up");
  });

  it("roundtrips", () => {
    expect(fromCompanySlug(toCompanySlug("four kites"))).toBe("four kites");
    expect(fromCompanySlug(toCompanySlug("i zettle"))).toBe("i zettle");
    expect(fromCompanySlug(toCompanySlug("disney+ hotstar"))).toBe("disney+ hotstar");
  });

  it("encodes literal plus and reserved characters", () => {
    expect(toCompanySlug("disney+ hotstar")).toBe("disney%2B%20hotstar");
    expect(toCompanySlug("c++ tools")).toBe("c%2B%2B%20tools");
    expect(toCompanySlug("100% remote")).toBe("100%25%20remote");
    expect(fromCompanySlug("disney%2B%20hotstar")).toBe("disney+ hotstar");
  });

  it("returns empty string on malformed input", () => {
    expect(fromCompanySlug("%E0%A4%A")).toBe("");
  });
});
