import { describe, expect, it, vi } from "vitest";
import { formatError, logError, logEvent } from "./logger";

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

describe("log levels", () => {
  it("tags info events and routes errors to console.error", () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    logEvent("tick", { n: 1 });
    logError("crawl_failed", { error: "boom" });
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toEqual({
      event: "tick",
      level: "info",
      n: 1,
    });
    expect(JSON.parse(error.mock.calls[0]?.[0] as string)).toEqual({
      event: "crawl_failed",
      level: "error",
      error: "boom",
    });
    info.mockRestore();
    error.mockRestore();
  });
});
