export function cacheKv(env: Pick<CloudflareEnv, "CACHE">): KVNamespace {
  return env.CACHE;
}
