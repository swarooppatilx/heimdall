import { describe, expect, it } from "vitest";
import { LEVELS } from "@/lib/level";
import { detectLevel } from "@/server/jobs/level";
import { sanitizeFilterValue } from "@/server/jobs/sanitize";

describe("detectLevel", () => {
  it("marks internships, co-ops and working students as intern", () => {
    expect(detectLevel("Software Engineering Intern, Android")).toBe("intern");
    expect(detectLevel("Summer Internship, Data")).toBe("intern");
    expect(detectLevel("People Operations Working Student")).toBe("intern");
  });

  it("marks new grads and juniors as entry", () => {
    expect(detectLevel("Product Manager, New Grad (2026)")).toBe("entry");
    expect(detectLevel("Jr. Marketing Specialist")).toBe("entry");
    expect(detectLevel("Entry-Level Data Analyst")).toBe("entry");
  });

  it("marks senior titles as senior", () => {
    expect(detectLevel("Senior Backend Engineer")).toBe("senior");
    expect(detectLevel("Sr. Software Engineer")).toBe("senior");
  });

  it("marks staff, principal, lead and leadership titles as lead, even when also senior", () => {
    expect(detectLevel("Staff Engineer")).toBe("lead");
    expect(detectLevel("Senior Staff Engineer")).toBe("lead");
    expect(detectLevel("Principal Software Engineer")).toBe("lead");
    expect(detectLevel("Engineering Lead")).toBe("lead");
    expect(detectLevel("Head of Design")).toBe("lead");
    expect(detectLevel("Senior Director, Product")).toBe("lead");
    expect(detectLevel("VP of Engineering")).toBe("lead");
  });

  it("keeps recruiters for early-career programs senior when the title says so", () => {
    expect(detectLevel("Senior Recruiter, Early Careers")).toBe("senior");
  });

  it("does not read associate or a trailing I as entry", () => {
    expect(detectLevel("Sr. Associate, Compliance")).toBe("senior");
    expect(detectLevel("Warehouse Associate")).toBe("mid");
    expect(detectLevel("Associate General Counsel")).toBe("mid");
    expect(detectLevel("Software Engineer I")).toBe("mid");
  });

  it("does not mistake words that contain a level", () => {
    expect(detectLevel("Internal Auditor")).toBe("mid");
    expect(detectLevel("Leadership Development Partner")).toBe("mid");
  });

  it("defaults to mid", () => {
    expect(detectLevel("Software Engineer")).toBe("mid");
    expect(detectLevel("")).toBe("mid");
  });
});

describe("level vocabulary", () => {
  it("survives the query sanitizer unchanged", () => {
    for (const level of LEVELS) expect(sanitizeFilterValue(level)).toBe(level);
  });
});
