import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import { bindDb } from "@/server/db";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

function isComment(line: string): boolean {
  return line.trim().startsWith("--");
}

function migrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .flatMap((file) =>
      readFileSync(join(MIGRATIONS_DIR, file), "utf8").split(/--> statement-breakpoint|;\s*$/m),
    )
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !isComment(line))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * A fresh in-memory D1 from workerd (the same SQLite build and limits as
 * production) with every migration applied, bound as the app's database.
 */
export async function createTestD1(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<CloudflareEnv>({ persist: false });
  const db = proxy.env.DB;
  for (const statement of migrationStatements()) {
    await db.prepare(statement).run();
  }
  bindDb(db);
  return { db, dispose: () => proxy.dispose() };
}
