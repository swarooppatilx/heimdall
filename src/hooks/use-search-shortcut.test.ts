import { describe, expect, it } from "vitest";
import { isSearchShortcut } from "@/hooks/use-search-shortcut";

const slash = {
  key: "/",
  target: null,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  isComposing: false,
};

describe("isSearchShortcut", () => {
  it("focuses search on a bare slash", () => {
    expect(isSearchShortcut(slash)).toBe(true);
  });

  it("leaves modifier chords like ctrl+/ to the browser", () => {
    expect(isSearchShortcut({ ...slash, ctrlKey: true })).toBe(false);
    expect(isSearchShortcut({ ...slash, metaKey: true })).toBe(false);
    expect(isSearchShortcut({ ...slash, altKey: true })).toBe(false);
  });

  it("ignores a slash typed during ime composition", () => {
    expect(isSearchShortcut({ ...slash, isComposing: true })).toBe(false);
  });
});
