import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "@/server/api/security";

describe("constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("hello", "hello")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(constantTimeEqual("hello", "world")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });

  it("returns false when first is longer", () => {
    expect(constantTimeEqual("abcd", "abc")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("returns false for empty vs non-empty", () => {
    expect(constantTimeEqual("", "a")).toBe(false);
  });

  it("handles unicode correctly", () => {
    expect(constantTimeEqual("cafe\u0301", "cafe\u0301")).toBe(true);
    expect(constantTimeEqual("cafe\u0301", "cafe")).toBe(false);
  });

  it("handles single character strings", () => {
    expect(constantTimeEqual("a", "a")).toBe(true);
    expect(constantTimeEqual("a", "b")).toBe(false);
  });
});
