import { describe, expect, it } from "vitest";
import { dedupeJobs, dedupeKey } from "@/lib/job";

const role = (company: string, title: string) => ({ company, title });

describe("dedupeKey", () => {
  it("treats the same role as one regardless of case and accents", () => {
    expect(dedupeKey(role("Acme", "Senior Engineer"))).toBe(
      dedupeKey(role("acme", "senior engineer")),
    );
    expect(dedupeKey(role("acme", "Ingénieur"))).toBe(dedupeKey(role("acme", "ingenieur")));
  });

  it("keeps the same title at different companies apart", () => {
    expect(dedupeKey(role("acme", "Engineer"))).not.toBe(dedupeKey(role("globex", "Engineer")));
  });

  it("counts repeat listings as openings of one card", () => {
    const cards = dedupeJobs(
      [role("acme", "Engineer"), role("ACME", "engineer"), role("acme", "Designer")],
      dedupeKey,
    );
    expect(cards.map((card) => card.openings)).toEqual([2, 1]);
  });
});
