import { describe, expect, it } from "vitest";
import { sweepSlice } from "./crawler";

const registry = Array.from({ length: 21 }, (_, i) => ({
  name: `c${i}`,
  provider: "greenhouse",
  board: `b${i}`,
}));

describe("sweepSlice", () => {
  it("covers every company across a full sweep", () => {
    const seen = new Set<string>();
    for (let tick = 0; tick < 8; tick++) {
      const now = tick * 15 * 60 * 1000;
      for (const entry of sweepSlice(registry, now)) {
        seen.add(entry.name);
      }
    }
    expect(seen.size).toBe(21);
  });

  it("is deterministic within a tick and advances across ticks", () => {
    const base = 1_755_000_000_000;
    const aligned = base - (base % (15 * 60 * 1000));
    expect(sweepSlice(registry, aligned)).toEqual(sweepSlice(registry, aligned + 60_000));
    expect(sweepSlice(registry, aligned)).not.toEqual(
      sweepSlice(registry, aligned + 15 * 60 * 1000),
    );
  });

  it("never returns an empty slice for a non-empty registry", () => {
    for (let tick = 0; tick < 96; tick++) {
      const now = tick * 15 * 60 * 1000;
      expect(sweepSlice(registry, now).length).toBeGreaterThan(0);
    }
  });
});
