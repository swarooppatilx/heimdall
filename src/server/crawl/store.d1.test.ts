import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getDriftedBoards,
  getLastModified,
  getLatestCrawlUnix,
  hasChangesSince,
  recordCrawl,
} from "@/server/crawl/store";
import { createTestD1 } from "@/server/testing/d1";

let db: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestD1());
}, 60_000);

afterAll(() => dispose());

beforeEach(async () => {
  await db.prepare("DELETE FROM board_status").run();
});

const board = "greenhouse/acme";

function crawl(jobsFound: number, extra: { lastModified?: string; changed?: boolean } = {}) {
  return recordCrawl({ board, status: "ok", jobsFound, durationMs: 10, ...extra });
}

describe("crawl status against D1", () => {
  it("counts consecutive empty crawls and resets when jobs come back", async () => {
    await crawl(0);
    await crawl(0);
    expect(await getDriftedBoards(2)).toEqual([{ board, consecutiveEmpty: 2 }]);

    await crawl(5);
    expect(await getDriftedBoards(1)).toEqual([]);
  });

  it("keeps the last Last-Modified when a crawl doesn't send one", async () => {
    await crawl(3, { lastModified: "Wed, 01 Oct 2026 10:00:00 GMT" });
    await crawl(3);

    expect(await getLastModified(board)).toBe("Wed, 01 Oct 2026 10:00:00 GMT");
  });

  it("reports changes only after a crawl that wrote data", async () => {
    const before = Date.now() - 60_000;
    await crawl(3);
    expect(await hasChangesSince(before)).toBe(false);

    await crawl(4, { changed: true });
    expect(await hasChangesSince(before)).toBe(true);
  });

  it("reports the most recent crawl time from board status", async () => {
    expect(await getLatestCrawlUnix()).toBeNull();
    const before = Date.now() - 5_000;
    await crawl(1);

    expect(await getLatestCrawlUnix()).toBeGreaterThanOrEqual(before);
  });
});
