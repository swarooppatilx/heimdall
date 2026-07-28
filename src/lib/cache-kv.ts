import { getCloudflareContext } from "@opennextjs/cloudflare";

export function cacheKv(): KVNamespace | undefined {
  try {
    const { env } = getCloudflareContext();
    return (env as { CACHE?: KVNamespace }).CACHE;
  } catch {
    return undefined;
  }
}

export async function hashedCacheKey(prefix: string, value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${prefix}:${hex}`;
}
