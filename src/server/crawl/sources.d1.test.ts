import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSourcesByKeys, listCrawlableSources, markSourceHealth } from "@/server/crawl/sources";
import seed from "@/server/crawl/sources.seed.json";
import { recordCrawl } from "@/server/crawl/store";
import { createTestD1 } from "@/server/testing/d1";

let db: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestD1());
}, 60_000);

afterAll(() => dispose());

beforeEach(async () => {
  await db.batch([
    db.prepare("UPDATE sources SET status = 'active'"),
    db.prepare("DELETE FROM board_status"),
  ]);
});

async function statusOf(board: string): Promise<string | undefined> {
  const row = await db
    .prepare("SELECT status FROM sources WHERE board = ?")
    .bind(board)
    .first<{ status: string }>();
  return row?.status;
}

describe("sources against D1", () => {
  it("is seeded with every board from the seed file", async () => {
    expect(await listCrawlableSources()).toHaveLength(seed.length);
  });

  it("never schedules a board marked dead", async () => {
    const [first] = await listCrawlableSources();
    const key = `${first?.provider}/${first?.name}`;
    await db.prepare("UPDATE sources SET status = 'dead' WHERE board = ?").bind(key).run();

    const sources = await listCrawlableSources();
    expect(sources).toHaveLength(seed.length - 1);
    expect(sources.some((s) => `${s.provider}/${s.name}` === key)).toBe(false);
  });

  it("looks up boards by key and keeps their labels", async () => {
    const labelled = seed.find((entry) => "label" in entry && entry.label);
    const key = `${labelled?.provider}/${labelled?.name}`;

    const [source] = await getSourcesByKeys([key, "greenhouse/not-a-board"]);
    expect(source).toEqual({
      name: labelled?.name,
      provider: labelled?.provider,
      label: labelled?.label,
    });
  });

  it("degrades a board that keeps crawling empty and restores it when jobs return", async () => {
    const [first] = await listCrawlableSources();
    const board = `${first?.provider}/${first?.name}`;
    for (let i = 0; i < 3; i += 1) {
      await recordCrawl({ board, status: "ok", jobsFound: 0, durationMs: 1 });
    }

    await markSourceHealth(3);
    expect(await statusOf(board)).toBe("degraded");

    await recordCrawl({ board, status: "ok", jobsFound: 4, durationMs: 1 });
    await markSourceHealth(3);
    expect(await statusOf(board)).toBe("active");
  });
});
