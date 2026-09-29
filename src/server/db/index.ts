import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

export type Db = ReturnType<typeof drizzle>;

let _db: Promise<Db> | null = null;
let boundDatabase: D1Database | null = null;

export function getDb(): Promise<Db> {
  if (!_db) {
    _db = (async () => {
      const { env } = await getCloudflareContext({ async: true });
      return drizzle(env.DB);
    })().catch((err: unknown) => {
      _db = null;
      throw err;
    });
  }
  return _db;
}

/** Used by the cron, the queue consumer and tests, which run outside a request. */
export function bindDb(database: D1Database): void {
  boundDatabase = database;
  _db = Promise.resolve(drizzle(database));
}

/**
 * Reads for a page or API request, through a D1 session so they can be served
 * by the nearest read replica. Sessions are request-scoped, so this opens one
 * per call rather than caching it. Bound callers (cron, queue, tests) read the
 * primary: the cron rebuilds caches right after writing and must see its writes.
 */
export async function getReadDb(): Promise<Db> {
  if (boundDatabase) return drizzle(boundDatabase);
  const { env } = await getCloudflareContext({ async: true });
  // Drizzle only calls prepare() and batch(), which a session provides too.
  return drizzle(env.DB.withSession("first-unconstrained") as unknown as D1Database);
}
