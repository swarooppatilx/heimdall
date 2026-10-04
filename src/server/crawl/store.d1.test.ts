import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getDriftedBoards,
  getLatestCrawlUnix,
  getValidator,
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

function crawl(jobsFound: number, extra: { validator?: string; changed?: boolean } = {}) {
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

  it("keeps the last validator when a crawl doesn't send one", async () => {
    await crawl(3, { validator: 'W/"abc123"' });
    await crawl(3);

    expect(await getValidator(board)).toBe('W/"abc123"');
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
