const RULES: [RegExp, string][] = [
  [
    /engineer|developer|software|infrastructure|\bsre\b|devops|site reliability|data scient|machine learning|\bml\b|\bai\b|architect|full[ -]stack|backend|frontend|programmer/i,
    "engineering",
  ],
  [/product manager|product owner|product design/i, "product"],
  [/design(?:er)?\b|ux\b|\bui\b|creative/i, "design"],
  [/sales|account executive|business development|partnerships?/i, "sales"],
  [/market(?:ing|s)\b|growth\b|communications?\b|brand\b/i, "marketing"],
  [/recruit|people\b|human resources|\bhr\b|talent\b|workplace/i, "people"],
  [/financ(?:e|ial)|account(?:ing|ant)|payroll|treasury/i, "finance"],
  [/customer (success|support|experience)|client service|helpdesk/i, "customer support"],
  [
    /analyst|analytics|business intelligence|\bdata\b(?= (?:analyst|analytics))/i,
    "data & analytics",
  ],
  [/legal|counsel|paralegal|compliance/i, "legal"],
  [/operations?|logistics|supply chain/i, "operations"],
];

export function inferDepartment(title: string): string {
  for (const [pattern, department] of RULES) {
    if (pattern.test(title)) return department;
  }
  return "general";
}
