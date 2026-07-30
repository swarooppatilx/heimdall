import { afterEach, describe, expect, it } from "vitest";
import {
  configureFreshness,
  currentFreshnessDays,
  DEFAULT_FRESHNESS_DAYS,
  freshnessCutoff,
} from "@/lib/freshness";

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  configureFreshness(DEFAULT_FRESHNESS_DAYS);
});

describe("freshnessCutoff", () => {
  it("returns a timestamp exactly the configured days before the given date", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const expected = new Date(now.getTime() - currentFreshnessDays() * DAY_MS).toISOString();
    expect(freshnessCutoff(now)).toBe(expected);
  });

  it("defaults to the current time", () => {
    const before = Date.now() - DEFAULT_FRESHNESS_DAYS * DAY_MS;
    const cutoff = new Date(freshnessCutoff()).getTime();
    const after = Date.now() - DEFAULT_FRESHNESS_DAYS * DAY_MS;
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

describe("configureFreshness", () => {
  it("accepts valid windows", () => {
    configureFreshness("30");
    expect(currentFreshnessDays()).toBe(30);
    configureFreshness(7);
    expect(currentFreshnessDays()).toBe(7);
  });

  it("rejects invalid values and keeps the previous window", () => {
    configureFreshness(0);
    expect(currentFreshnessDays()).toBe(DEFAULT_FRESHNESS_DAYS);
    configureFreshness("nonsense");
    expect(currentFreshnessDays()).toBe(DEFAULT_FRESHNESS_DAYS);
    configureFreshness(91);
    expect(currentFreshnessDays()).toBe(DEFAULT_FRESHNESS_DAYS);
  });
});
