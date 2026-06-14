import { describe, expect, it } from "vitest";
import { FRESHNESS_DAYS, freshnessCutoff } from "./freshness";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("freshnessCutoff", () => {
  it("returns a timestamp exactly FRESHNESS_DAYS before the given date", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const expected = new Date(now.getTime() - FRESHNESS_DAYS * DAY_MS).toISOString();
    expect(freshnessCutoff(now)).toBe(expected);
  });

  it("defaults to the current time", () => {
    const before = Date.now() - FRESHNESS_DAYS * DAY_MS;
    const cutoff = new Date(freshnessCutoff()).getTime();
    const after = Date.now() - FRESHNESS_DAYS * DAY_MS;
    expect(cutoff).toBeGreaterThanOrEqual(before);
    expect(cutoff).toBeLessThanOrEqual(after);
  });

  it("produces ISO strings that sort correctly against stored posted_at values", () => {
    const now = new Date("2026-08-21T00:00:00.000Z");
    const cutoff = freshnessCutoff(now);
    expect(new Date("2026-08-10T00:00:00.000Z").toISOString() > cutoff).toBe(true);
    expect(new Date("2026-07-01T00:00:00.000Z").toISOString() > cutoff).toBe(false);
  });
});
