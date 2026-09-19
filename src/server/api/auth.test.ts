import { describe, expect, it } from "vitest";
import { requireToken } from "@/server/api/auth";

function makeRequest(headerKey: string, value?: string): Request {
  const headers: Record<string, string> = {};
  if (value !== undefined) headers[headerKey] = value;
  return new Request("http://localhost", { headers });
}

describe("requireToken", () => {
  it("returns true when token matches", () => {
    const env = { MY_TOKEN: "secret123" };
    const req = makeRequest("x-my-token", "secret123");
    expect(requireToken({ env, envKey: "MY_TOKEN", headerKey: "x-my-token" }, req)).toBe(true);
  });

  it("returns false when token does not match", () => {
    const env = { MY_TOKEN: "secret123" };
    const req = makeRequest("x-my-token", "wrong");
    expect(requireToken({ env, envKey: "MY_TOKEN", headerKey: "x-my-token" }, req)).toBe(false);
  });

  it("returns false when header is missing", () => {
    const env = { MY_TOKEN: "secret123" };
    const req = makeRequest("x-my-token");
    expect(requireToken({ env, envKey: "MY_TOKEN", headerKey: "x-my-token" }, req)).toBe(false);
  });

  it("returns false when env key is missing", () => {
    const env = {};
    const req = makeRequest("x-my-token", "secret123");
    expect(requireToken({ env, envKey: "MY_TOKEN", headerKey: "x-my-token" }, req)).toBe(false);
  });

  it("returns false when env key is empty string", () => {
    const env = { MY_TOKEN: "" };
    const req = makeRequest("x-my-token", "");
    expect(requireToken({ env, envKey: "MY_TOKEN", headerKey: "x-my-token" }, req)).toBe(false);
  });

  it("returns false when env value is undefined", () => {
    const env = { MY_TOKEN: undefined };
    const req = makeRequest("x-my-token", "secret123");
    expect(requireToken({ env, envKey: "MY_TOKEN", headerKey: "x-my-token" }, req)).toBe(false);
  });
});
