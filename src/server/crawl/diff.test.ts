import { describe, expect, it } from "vitest";
import type { Job } from "@/lib/job";
import { diffJobs, isSuspiciousDeletion } from "@/server/crawl/diff";

function job(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    title: `Role ${id}`,
    company: "acme",
    location: "Remote — United States",
    department: "Engineering",
    url: `https://example.com/${id}`,
    postedAt: new Date("2026-08-20T00:00:00.000Z"),
    source: "greenhouse",
    ...overrides,
  };
}

describe("diffJobs", () => {
  it("classifies new jobs as inserts", () => {
    const diff = diffJobs([], [job("a"), job("b")]);
    expect(diff.inserts.map((j) => j.id)).toEqual(["a", "b"]);
    expect(diff.updates).toHaveLength(0);
    expect(diff.deletedIds).toHaveLength(0);
  });

  it("skips unchanged jobs entirely", () => {
    const stored = job("a", { url: "https://example.com/stored" });
    const fetched = job("a", { url: "https://example.com/stored" });
    const diff = diffJobs([stored], [fetched]);
    expect(diff.inserts).toHaveLength(0);
    expect(diff.updates).toHaveLength(0);
    expect(diff.deletedIds).toHaveLength(0);
  });

  it("flags changed fields as updates", () => {
    const stored = job("a", { title: "Old Title" });
    const fetched = job("a", { title: "New Title" });
    const diff = diffJobs([stored], [fetched]);
    expect(diff.updates.map((u) => u.job.id)).toEqual(["a"]);
  });

  it("keeps the first seen date when a provider bumps postedAt forward", () => {
    const stored = job("a");
    const bumped = job("a", { postedAt: new Date("2026-08-21T00:00:00.000Z") });
    const diff = diffJobs([stored], [bumped]);
    expect(diff.updates).toHaveLength(0);
  });

  it("allows postedAt corrections backwards", () => {
    const stored = job("a", { postedAt: new Date("2026-08-22T00:00:00.000Z") });
    const corrected = job("a", { postedAt: new Date("2026-08-20T00:00:00.000Z") });
    const diff = diffJobs([stored], [corrected]);
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]?.job.postedAt.toISOString()).toBe("2026-08-20T00:00:00.000Z");
  });

  it("ignores sub-minute postedAt drift", () => {
    const stored = job("a");
    const drifted = job("a", { postedAt: new Date("2026-08-20T00:00:30.000Z") });
    const diff = diffJobs([stored], [drifted]);
    expect(diff.updates).toHaveLength(0);
  });

  it("flags a level change as an update", () => {
    const stored = job("a", { level: "mid" });
    const reclassified = job("a", { level: "senior" });
    expect(diffJobs([stored], [reclassified]).updates).toHaveLength(1);
  });

  it("flags title changes as updates", () => {
    const stored = job("a");
    const retitled = job("a", { title: "Staff Role" });
    const diff = diffJobs([stored], [retitled]);
    expect(diff.updates).toHaveLength(1);
  });

  it("flags company renames as updates", () => {
    const stored = job("a", { company: "acme" });
    const renamed = job("a", { company: "Acme Corp" });
    const diff = diffJobs([stored], [renamed]);
    expect(diff.updates).toHaveLength(1);
  });

  it("reports stored jobs missing from the fetch as deleted ids", () => {
    const diff = diffJobs([job("a"), job("gone")], [job("a")]);
    expect(diff.deletedIds).toEqual(["gone"]);
  });

  it("handles the mixed case in one pass", () => {
    const existing = [job("same"), job("edited", { title: "Before" }), job("closed")];
    const fetched = [job("same"), job("edited"), job("brand-new")];
    const diff = diffJobs(existing, fetched);
    expect(diff.inserts.map((j) => j.id)).toEqual(["brand-new"]);
    expect(diff.updates.map((u) => u.job.id)).toEqual(["edited"]);
    expect(diff.deletedIds).toEqual(["closed"]);
  });

  it("reports location-only changes in changed fields", () => {
    const stored = job("a", { location: "New York" });
    const fetched = job("a", { location: "London" });
    const diff = diffJobs([stored], [fetched]);
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]?.changed.location).toBe(true);
    expect(diff.updates[0]?.changed.core).toBe(false);
  });

  it("reports core-only changes in changed fields", () => {
    const stored = job("a", { title: "Engineer", location: "NYC" });
    const fetched = job("a", { title: "Senior Engineer", location: "NYC" });
    const diff = diffJobs([stored], [fetched]);
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]?.changed.location).toBe(false);
    expect(diff.updates[0]?.changed.core).toBe(true);
  });

  it("reports both groups changed when multiple fields differ", () => {
    const stored = job("a", { title: "Engineer", location: "NYC" });
    const fetched = job("a", { title: "Senior Engineer", location: "London" });
    const diff = diffJobs([stored], [fetched]);
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]?.changed.location).toBe(true);
    expect(diff.updates[0]?.changed.core).toBe(true);
  });

  it("flags mass deletions as suspicious", () => {
    expect(isSuspiciousDeletion(100, 51)).toBe(true);
    expect(isSuspiciousDeletion(100, 50)).toBe(false);
  });

  it("ignores small boards where churn is normal", () => {
    expect(isSuspiciousDeletion(9, 9)).toBe(false);
    expect(isSuspiciousDeletion(0, 0)).toBe(false);
  });
});
