import { describe, expect, it } from "vitest";
import { fold } from "@/lib/fold";

describe("fold", () => {
  it("compares accented, upper-case and plain spellings as equal", () => {
    expect(fold("München")).toBe("munchen");
    expect(fold("MUNCHEN")).toBe("munchen");
    expect(fold("São Paulo")).toBe("sao paulo");
    expect(fold("Zürich")).toBe("zurich");
  });

  it("spells out letters that have no combining-mark form", () => {
    expect(fold("Straße")).toBe("strasse");
    expect(fold("Ørsted")).toBe("orsted");
    expect(fold("Łódź")).toBe("lodz");
  });
});
