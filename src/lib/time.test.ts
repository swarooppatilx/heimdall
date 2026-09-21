import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeAgo } from "@/lib/time";

const NOW = new Date("2026-10-01T12:00:00.000Z");

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says now for anything under a minute, including future dates", () => {
    expect(timeAgo(ago(30_000))).toBe("now");
    expect(timeAgo(ago(-60_000))).toBe("now");
  });

  it("uses the largest whole unit", () => {
    expect(timeAgo(ago(53 * 60_000))).toBe("53m");
    expect(timeAgo(ago(5 * 3_600_000 + 59 * 60_000))).toBe("5h");
    expect(timeAgo(ago(2 * 86_400_000 + 5 * 3_600_000))).toBe("2d");
  });

  it("accepts ISO strings from JSON payloads", () => {
    expect(timeAgo(ago(3_600_000).toISOString())).toBe("1h");
  });
});
