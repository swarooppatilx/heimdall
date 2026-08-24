import { describe, expect, it } from "vitest";
import { getRegistry } from "@/lib/registry";

const KNOWN_PROVIDERS = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workday",
  "workable",
]);

describe("registry", () => {
  const registry = getRegistry();

  it("only uses providers with fetchers", () => {
    for (const entry of registry) {
      expect(KNOWN_PROVIDERS.has(entry.provider), `${entry.name}: ${entry.provider}`).toBe(true);
    }
  });

  it("has unique names per provider", () => {
    const keys = registry.map((entry) => `${entry.provider}:${entry.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has non-empty fields on every entry", () => {
    for (const entry of registry) {
      expect(entry.name.trim()).not.toBe("");
    }
  });
});
