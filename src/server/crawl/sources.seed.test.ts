import { describe, expect, it } from "vitest";
import seed from "@/server/crawl/sources.seed.json";

const KNOWN_PROVIDERS = new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "workable"]);

// The seed bootstraps the `sources` table (migration 0025); validate it before it ships.
describe("sources seed", () => {
  const registry: { name: string; provider: string; label?: string }[] = seed;

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
