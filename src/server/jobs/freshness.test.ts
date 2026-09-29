import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureFreshness,
  currentFreshnessDays,
  DEFAULT_FRESHNESS_DAYS,
  freshnessCutoff,
} from "@/server/jobs/freshness";

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  configureFreshness(DEFAULT_FRESHNESS_DAYS);
});

describe("freshnessCutoff", () => {
  it("returns the configured days before the start of the current hour", () => {
    const now = new Date("2026-08-21T12:34:56.789Z");
    const hourStart = new Date("2026-08-21T12:00:00.000Z").getTime();
    expect(freshnessCutoff(now)).toBe(
      new Date(hourStart - currentFreshnessDays() * DAY_MS).toISOString(),
    );
  });

  it("stays the same across one hour so paging sees one result set", () => {
    expect(freshnessCutoff(new Date("2026-08-21T12:01:00.000Z"))).toBe(
      freshnessCutoff(new Date("2026-08-21T12:59:59.000Z")),
    );
  });

  it("defaults to the current time", () => {
    const before = Date.now() - DEFAULT_FRESHNESS_DAYS * DAY_MS - 60 * 60 * 1000;
    const cutoff = new Date(freshnessCutoff()).getTime();
    const after = Date.now();
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

describe("currentFreshnessDays", () => {
  it("falls back to the FRESHNESS_DAYS env var when not configured", async () => {
    vi.resetModules();
    vi.stubEnv("FRESHNESS_DAYS", "30");
    const fresh = await import("@/server/jobs/freshness");
    expect(fresh.currentFreshnessDays()).toBe(30);
    vi.unstubAllEnvs();
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
