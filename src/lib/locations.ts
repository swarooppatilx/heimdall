export function splitLocations(raw: string): string[] {
  return raw
    .split(/\s*[;•|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function primaryLocation(raw: string): string {
  return splitLocations(raw)[0] ?? "Unknown";
}
