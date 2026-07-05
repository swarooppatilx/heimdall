import { describe, expect, it } from "vitest";
import { sweepSlice } from "./crawler";

const registry = Array.from({ length: 19 }, (_, i) => ({
  name: `c${i}`,
  provider: "greenhouse",
}));

function sweep(ticks = 8): string[] {
  const seen: string[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    for (const entry of sweepSlice(registry, tick * 15 * 60 * 1000)) {
      seen.push(entry.name);
    }
  }
  return seen;
}

describe("sweepSlice", () => {
  it("covers every company exactly once per full sweep", () => {
    const seen = sweep();
    expect(seen).toHaveLength(registry.length);
    expect(new Set(seen).size).toBe(registry.length);
  });

  it("keeps slice sizes within one of each other", () => {
    const sizes: number[] = [];
    for (let tick = 0; tick < 8; tick++) {
      sizes.push(sweepSlice(registry, tick * 15 * 60 * 1000).length);
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("is deterministic within a tick", () => {
    const aligned = 1_755_000_000_000 - (1_755_000_000_000 % (15 * 60 * 1000));
    expect(sweepSlice(registry, aligned)).toEqual(sweepSlice(registry, aligned + 60_000));
  });

  it("handles registries smaller than the tick count without duplicates", () => {
    const small = registry.slice(0, 3);
    const seen: string[] = [];
    for (let tick = 0; tick < 8; tick++) {
      for (const entry of sweepSlice(small, tick * 15 * 60 * 1000)) {
        seen.push(entry.name);
      }
    }
    expect(new Set(seen).size).toBe(3);
  });
});
