import { describe, expect, it } from "vitest";
import { DEPARTMENTS, inferDepartment } from "@/server/jobs/department";
import { mapDepartment } from "@/server/jobs/department-map";
import { sanitizeFilterValue } from "@/server/jobs/sanitize";

describe("mapDepartment", () => {
  it("maps real ATS names onto buckets by exact folded match", () => {
    expect(mapDepartment(["Engineering"]).department).toBe("engineering");
    expect(mapDepartment(["R&D"]).department).toBe("engineering");
    expect(mapDepartment(["Sales & Partnerships"]).department).toBe("sales");
    expect(mapDepartment(["Accounting/Auditing"]).department).toBe("finance");
  });

  it("strips a cost-centre code before matching", () => {
    expect(mapDepartment(["12001 - Sales"]).department).toBe("sales");
  });

  it("falls through to the team when the department is an org unit", () => {
    const match = mapDepartment(["D Foundry II Zaragoza", "Hardware Engineering"]);
    expect(match.department).toBe("engineering");
    expect(match.unmapped).toEqual(["d foundry ii zaragoza"]);
  });

  it("treats placeholder answers as no answer, without reporting them", () => {
    expect(mapDepartment(["Other", "Not Applicable"])).toEqual({
      department: undefined,
      unmapped: [],
    });
  });
});

describe("department vocabulary", () => {
  it("round-trips every bucket through the table and the query sanitizer", () => {
    for (const department of DEPARTMENTS) {
      expect(mapDepartment([department]).department).toBe(department);
      expect(sanitizeFilterValue(department)).toBe(department);
    }
  });

  it("still guesses from the title when the ATS gives nothing", () => {
    expect(inferDepartment("Senior Product Designer")).toBe("product");
    expect(inferDepartment("Account Executive")).toBe("sales");
    expect(inferDepartment("Office Coordinator")).toBe("general");
  });
});
