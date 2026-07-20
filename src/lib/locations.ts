export function splitLocations(raw: string): string[] {
  return raw
    .split(/\s*[;•|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}
