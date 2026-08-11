import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { configureFreshness } from "@/lib/freshness";

export type Db = ReturnType<typeof drizzle>;

let _db: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!_db) {
    _db = (async () => {
      const { env } = await getCloudflareContext();
      configureFreshness((env as { FRESHNESS_DAYS?: string }).FRESHNESS_DAYS);
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

const CHUNK_SIZE = 100;

export function chunk<T>(items: T[]): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    pages.push(items.slice(i, i + CHUNK_SIZE));
  }
  return pages;
}
