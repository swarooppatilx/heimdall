const RULES: [RegExp, string][] = [
  [
    /engineer|developer|software|infrastructure|\bsre\b|devops|site reliability|data scient|machine learning|\bml\b|\bai\b|architect|full[ -]stack|backend|frontend|programmer/i,
    "Engineering",
  ],
  [/product manager|product owner|product design/i, "Product"],
  [/design(?:er)?\b|ux\b|\bui\b|creative/i, "Design"],
  [/sales|account executive|business development|partnerships?/i, "Sales"],
  [/market(?:ing|s)\b|growth\b|communications?\b|brand\b/i, "Marketing"],
  [/recruit|people\b|human resources|\bhr\b|talent\b|workplace/i, "People"],
  [/financ(?:e|ial)|account(?:ing|ant)|payroll|treasury/i, "Finance"],
  [/customer (success|support|experience)|client service|helpdesk/i, "Customer Support"],
  [
    /analyst|analytics|business intelligence|\bdata\b(?= (?:analyst|analytics))/i,
    "Data & Analytics",
  ],
  [/legal|counsel|paralegal|compliance/i, "Legal"],
  [/operations?|logistics|supply chain/i, "Operations"],
];

export function inferDepartment(title: string): string {
  for (const [pattern, department] of RULES) {
    if (pattern.test(title)) return department;
  }
  return "General";
}
