export function isRemoteLocation(location: string): boolean {
  return location.toLowerCase().startsWith("remote");
}
