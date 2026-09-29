// Secrets come from `wrangler secret put` or .dev.vars, which `wrangler types`
// only sees locally. Declaring them here keeps typecheck identical in CI.
interface CloudflareEnv {
  CRAWL_TRIGGER_TOKEN: string;
}
