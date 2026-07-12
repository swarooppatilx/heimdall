import { describe, expect, it } from "vitest";
import { assessBoards, driftedBoards } from "./board-health";

const sample = (company: string, jobsFound: number, status = "ok") => ({
  company,
  status,
  jobsFound,
});

describe("assessBoards", () => {
  it("counts consecutive empty crawls newest first", () => {
    const health = assessBoards([
      sample("vercel", 0),
      sample("vercel", 0),
      sample("vercel", 3),
      sample("vercel", 0),
    ])[0];
    expect(health?.consecutiveEmpty).toBe(2);
    expect(health?.crawls).toBe(4);
    expect(health?.errors).toBe(0);
  });

  it("stops counting at errors and treats them separately", () => {
    const health = assessBoards([
      sample("broadcom", 0),
      sample("broadcom", 0, "error"),
      sample("broadcom", 0),
      sample("broadcom", 5),
    ])[0];
    expect(health?.consecutiveEmpty).toBe(1);
    expect(health?.errors).toBe(1);
  });

  it("handles oldest-first input via ordering flag", () => {
    const health = assessBoards(
      [sample("netlify", 5), sample("netlify", 0), sample("netlify", 0)],
      false,
    )[0];
    expect(health?.consecutiveEmpty).toBe(2);
  });

  it("flags boards past the drift threshold", () => {
    const rows = [
      sample("vercel", 0),
      sample("vercel", 0),
      sample("vercel", 0),
      sample("stripe", 40),
      sample("stripe", 41),
    ];
    const drifted = driftedBoards(assessBoards(rows), 3);
    expect(drifted.map((b) => b.company)).toEqual(["vercel"]);
  });
});
