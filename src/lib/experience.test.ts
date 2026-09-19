import { describe, expect, it } from "vitest";
import { detectExperienceLevel } from "@/lib/experience";

describe("detectExperienceLevel", () => {
  describe("intern", () => {
    it("detects intern in title", () => {
      expect(detectExperienceLevel("Software Engineering Intern")).toBe("intern");
      expect(detectExperienceLevel("Data Science Internship")).toBe("intern");
      expect(detectExperienceLevel("intern")).toBe("intern");
    });

    it("does not match Internal", () => {
      expect(detectExperienceLevel("Senior Manager, Internal Audit")).toBe("senior");
      expect(detectExperienceLevel("Internal Auditor")).toBe("mid");
    });
  });

  describe("entry", () => {
    it("detects junior", () => {
      expect(detectExperienceLevel("Junior Software Engineer")).toBe("entry");
      expect(detectExperienceLevel("Jr. Frontend Developer")).toBe("entry");
    });

    it("detects entry level", () => {
      expect(detectExperienceLevel("Entry Level Software Engineer")).toBe("entry");
      expect(detectExperienceLevel("Entry-Level Data Analyst")).toBe("entry");
    });

    it("detects new grad", () => {
      expect(detectExperienceLevel("New Grad Software Engineer")).toBe("entry");
      expect(detectExperienceLevel("New Graduate Program")).toBe("entry");
    });

    it("detects associate", () => {
      expect(detectExperienceLevel("Associate Solutions Architect")).toBe("entry");
    });

    it("detects trainee", () => {
      expect(detectExperienceLevel("Engineering Trainee")).toBe("entry");
    });
  });

  describe("staff", () => {
    it("detects staff", () => {
      expect(detectExperienceLevel("Staff Engineer")).toBe("staff");
      expect(detectExperienceLevel("Staff Software Engineer")).toBe("staff");
    });

    it("detects principal", () => {
      expect(detectExperienceLevel("Principal Engineer")).toBe("staff");
      expect(detectExperienceLevel("Principal Software Engineer")).toBe("staff");
    });

    it("detects distinguished", () => {
      expect(detectExperienceLevel("Distinguished Engineer")).toBe("staff");
    });

    it("detects fellow", () => {
      expect(detectExperienceLevel("Technical Fellow")).toBe("staff");
    });
  });

  describe("senior", () => {
    it("detects senior", () => {
      expect(detectExperienceLevel("Senior Software Engineer")).toBe("senior");
      expect(detectExperienceLevel("Senior Backend Engineer")).toBe("senior");
    });

    it("detects sr.", () => {
      expect(detectExperienceLevel("Sr. Software Engineer")).toBe("senior");
      expect(detectExperienceLevel("Sr Product Manager")).toBe("senior");
    });

    it("detects lead", () => {
      expect(detectExperienceLevel("Engineering Lead")).toBe("senior");
      expect(detectExperienceLevel("Tech Lead")).toBe("senior");
    });

    it("detects director", () => {
      expect(detectExperienceLevel("Director of Engineering")).toBe("senior");
    });

    it("detects vp", () => {
      expect(detectExperienceLevel("VP of Engineering")).toBe("senior");
      expect(detectExperienceLevel("Vice President Product")).toBe("senior");
    });

    it("detects head of", () => {
      expect(detectExperienceLevel("Head of Engineering")).toBe("senior");
    });

    it("detects chief", () => {
      expect(detectExperienceLevel("Chief Technology Officer")).toBe("senior");
    });
  });

  describe("mid (default)", () => {
    it("returns mid for plain engineer titles", () => {
      expect(detectExperienceLevel("Software Engineer")).toBe("mid");
      expect(detectExperienceLevel("Backend Engineer")).toBe("mid");
      expect(detectExperienceLevel("Product Manager")).toBe("mid");
      expect(detectExperienceLevel("Data Analyst")).toBe("mid");
    });

    it("returns mid for empty string", () => {
      expect(detectExperienceLevel("")).toBe("mid");
    });
  });

  describe("case insensitivity", () => {
    it("matches regardless of case", () => {
      expect(detectExperienceLevel("SENIOR engineer")).toBe("senior");
      expect(detectExperienceLevel("staff ENGINEER")).toBe("staff");
      expect(detectExperienceLevel("intern")).toBe("intern");
    });
  });
});
