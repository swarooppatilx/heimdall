import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

export type Db = ReturnType<typeof drizzle>;

let _db: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!_db) {
    _db = (async () => {
      const { env } = await getCloudflareContext();
      return drizzle(env.DB);
    })().catch((err: unknown) => {
      _db = null;
      throw err;
    });
  }
  return _db;
}

export function bindDb(database: D1Database): void {
  _db = Promise.resolve(drizzle(database));
}
