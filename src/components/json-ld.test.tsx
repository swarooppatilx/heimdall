import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/components/json-ld";

describe("serializeJsonLd", () => {
  it("escapes script-breaking angle brackets", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
  });

  it("round-trips escaped values back to their original strings", () => {
    const value = { title: "<Senior> Engineer & Co" };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });
});
