import { describe, expect, it } from "vitest";
import { isHttpUrl } from "@/lib/url";

describe("isHttpUrl", () => {
  it("accepts absolute http and https links", () => {
    expect(isHttpUrl("https://boards.greenhouse.io/acme/jobs/1")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects script, data and relative links", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,hi")).toBe(false);
    expect(isHttpUrl("/jobs/1")).toBe(false);
  });
});
