import { describe, expect, it } from "vitest";
import { normalizeDepartment } from "@/lib/department";

describe("normalizeDepartment", () => {
  it("passes canonical buckets through", () => {
    expect(normalizeDepartment("Engineering")).toBe("engineering");
    expect(normalizeDepartment("data & analytics")).toBe("data & analytics");
    expect(normalizeDepartment("general")).toBe("general");
  });

  it("maps provider variants onto buckets", () => {
    expect(normalizeDepartment("Sales & Customer Success")).toBe("sales");
    expect(normalizeDepartment("Customer Experience")).toBe("customer support");
    expect(normalizeDepartment("Revenue Operations & Strategy ")).toBe("operations");
    expect(normalizeDepartment("User Research and Product Operations")).toBe("operations");
    expect(normalizeDepartment("Early Career")).toBe("general");
    expect(normalizeDepartment("Outcomes Architect")).toBe("engineering");
  });

  it("collapses whitespace and casing", () => {
    expect(normalizeDepartment("  Marketing   Ops ")).toBe("marketing");
    expect(normalizeDepartment("")).toBe("general");
  });
});
