import { describe, expect, it } from "vitest";
import { constantTimeEqual, requireToken } from "@/server/api/auth";

function makeRequest(headerKey: string, value?: string): Request {
  const headers: Record<string, string> = {};
  if (value !== undefined) headers[headerKey] = value;
  return new Request("http://localhost", { headers });
}

describe("requireToken", () => {
  it("returns true when token matches", () => {
    const env = { CRAWL_TRIGGER_TOKEN: "secret123" };
    const req = makeRequest("x-my-token", "secret123");
    expect(requireToken({ env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-my-token" }, req)).toBe(
      true,
    );
  });

  it("returns false when token does not match", () => {
    const env = { CRAWL_TRIGGER_TOKEN: "secret123" };
    const req = makeRequest("x-my-token", "wrong");
    expect(requireToken({ env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-my-token" }, req)).toBe(
      false,
    );
  });

  it("returns false when header is missing", () => {
    const env = { CRAWL_TRIGGER_TOKEN: "secret123" };
    const req = makeRequest("x-my-token");
    expect(requireToken({ env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-my-token" }, req)).toBe(
      false,
    );
  });

  it("returns false when env key is missing", () => {
    const env = {};
    const req = makeRequest("x-my-token", "secret123");
    expect(requireToken({ env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-my-token" }, req)).toBe(
      false,
    );
  });

  it("returns false when env key is empty string", () => {
    const env = { CRAWL_TRIGGER_TOKEN: "" };
    const req = makeRequest("x-my-token", "");
    expect(requireToken({ env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-my-token" }, req)).toBe(
      false,
    );
  });

  it("returns false when env value is undefined", () => {
    const env = {};
    const req = makeRequest("x-my-token", "secret123");
    expect(requireToken({ env, envKey: "CRAWL_TRIGGER_TOKEN", headerKey: "x-my-token" }, req)).toBe(
      false,
    );
  });
});

describe("constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("hello", "hello")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(constantTimeEqual("hello", "world")).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
  });

  it("returns false when first is longer", () => {
    expect(constantTimeEqual("abcd", "abc")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("returns false for empty vs non-empty", () => {
    expect(constantTimeEqual("", "a")).toBe(false);
  });

  it("handles unicode correctly", () => {
    expect(constantTimeEqual("cafe\u0301", "cafe\u0301")).toBe(true);
    expect(constantTimeEqual("cafe\u0301", "cafe")).toBe(false);
  });

  it("handles single character strings", () => {
    expect(constantTimeEqual("a", "a")).toBe(true);
    expect(constantTimeEqual("a", "b")).toBe(false);
  });
});
