import { describe, expect, it } from "vitest";
import { formatError } from "./logger";

describe("formatError", () => {
  it("appends captured frames for errors with a stack trace", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n    at crawlOne (crawler.ts:95)\n    at run (loop.ts:10)";
    expect(formatError(err)).toBe("boom — at crawlOne (crawler.ts:95) | at run (loop.ts:10)");
  });

  it("marks opaque errors whose stacks carry no frames", () => {
    const err = new Error("Cannot read properties of undefined");
    err.stack = "TypeError: Cannot read properties of undefined";
    expect(formatError(err)).toBe("Cannot read properties of undefined [no stack]");
  });

  it("stringifies non-error rejections", () => {
    expect(formatError("d1 unreachable")).toBe("d1 unreachable");
  });
});
