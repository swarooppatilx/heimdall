import { fold } from "@/lib/fold";

// ATS department, team and function names mapped to our buckets by exact,
// folded match. Built from a sample of real board payloads (2026-10-02); grow
// it from the `taxonomy_unmapped` log rather than by guessing. Org units and
// site names ("d foundry ii", "selectleaders") are deliberately absent: they
// say nothing about the role, so the title decides.
const DEPARTMENT_TABLE: Record<string, string> = {
  engineering: "engineering",
  "software engineering": "engineering",
  "hardware engineering": "engineering",
  "security engineering": "engineering",
  "r&d": "engineering",
  "research & development": "engineering",
  "research and development": "engineering",
  technology: "engineering",
  "information technology": "engineering",
  it: "engineering",
  infrastructure: "engineering",
  security: "engineering",
  ai: "engineering",
  "ai & research": "engineering",
  "artificial intelligence": "engineering",
  "machine learning": "engineering",
  "computer science": "engineering",
  "quality assurance": "engineering",
  product: "product",
  "product management": "product",
  design: "design",
  "product design": "design",
  "user experience": "design",
  creative: "design",
  sales: "sales",
  "sales & partnerships": "sales",
  partnerships: "sales",
  "business development": "sales",
  "business development representative": "sales",
  "account management": "sales",
  "sales development": "sales",
  marketing: "marketing",
  growth: "marketing",
  communications: "marketing",
  brand: "marketing",
  people: "people",
  "human resources": "people",
  hr: "people",
  talent: "people",
  recruiting: "people",
  "talent acquisition": "people",
  "people operations": "people",
  finance: "finance",
  accounting: "finance",
  "accounting/auditing": "finance",
  "finance & accounting": "finance",
  "customer success": "customer support",
  "customer support": "customer support",
  "customer service": "customer support",
  "customer experience": "customer support",
  support: "customer support",
  data: "data & analytics",
  analytics: "data & analytics",
  "data & analytics": "data & analytics",
  "data science": "data & analytics",
  "business intelligence": "data & analytics",
  legal: "legal",
  compliance: "legal",
  "legal & compliance": "legal",
  operations: "operations",
  "global operations": "operations",
  "business operations": "operations",
  "supply chain": "operations",
  logistics: "operations",
  purchasing: "operations",
  procurement: "operations",
  manufacturing: "operations",
  production: "operations",
  facilities: "operations",
  general: "general",
};

// Placeholder answers some ATSes send; known, so not reported as unmapped.
const NON_ANSWERS = new Set(["other", "not applicable", "n/a", "none"]);

// "12001 - Account Executives" carries a cost-centre code before the name.
const CODE_PREFIX = /^\d+\s*-\s*/;

function key(value: string): string {
  return fold(value).replace(CODE_PREFIX, "").replace(/\s+/g, " ").trim();
}

export interface DepartmentMatch {
  department: string | undefined;
  unmapped: string[];
}

/** The first hint (department, then team, then function) that names a known bucket. */
export function mapDepartment(hints: readonly string[]): DepartmentMatch {
  const unmapped: string[] = [];
  for (const hint of hints) {
    const folded = key(hint);
    if (!folded || NON_ANSWERS.has(folded)) continue;
    const department = DEPARTMENT_TABLE[folded];
    if (department) return { department, unmapped };
    unmapped.push(folded);
  }
  return { department: undefined, unmapped };
}
