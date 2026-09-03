export function cacheKv(env: Pick<CloudflareEnv, "CACHE">): KVNamespace | undefined {
  return env.CACHE;
}
