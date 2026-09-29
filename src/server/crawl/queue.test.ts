import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOARDS_PER_MESSAGE,
  type CrawlMessage,
  enqueueBoards,
  handleCrawlBatch,
  toCrawlMessages,
} from "@/server/crawl/queue";

const { crawlAllMock } = vi.hoisted(() => ({ crawlAllMock: vi.fn() }));

vi.mock("@/server/crawl/scheduler", () => ({
  crawlAll: (...args: unknown[]) => crawlAllMock(...args),
}));

vi.mock("@/server/crawl/sources", () => {
  const known = [
    { name: "a", provider: "greenhouse" },
    { name: "b", provider: "lever" },
    { name: "c", provider: "ashby" },
  ];
  const boardKey = (entry: { name: string; provider: string }) => `${entry.provider}/${entry.name}`;
  return {
    boardKey,
    getSourcesByKeys: async (keys: string[]) =>
      known.filter((entry) => keys.includes(boardKey(entry))),
  };
});

function board(i: number) {
  return { name: `board${i}`, provider: "greenhouse" };
}

function fakeQueue() {
  return {
    sendBatch: vi.fn((_messages: { body: CrawlMessage }[]) => Promise.resolve()),
  } as unknown as Queue<CrawlMessage> & { sendBatch: ReturnType<typeof vi.fn> };
}

function batchOf(...bodies: CrawlMessage[]) {
  const messages = bodies.map((body) => ({ body, ack: vi.fn() }));
  return { messages } as unknown as MessageBatch<CrawlMessage> & { messages: typeof messages };
}

function runOf(...boards: string[]) {
  return {
    results: boards.map((board) => ({ board, status: "ok" })),
    discovered: 0,
    durationMs: 1,
    skipped: 0,
    wrote: false,
  };
}

describe("toCrawlMessages", () => {
  it("groups boards into fixed-size messages", () => {
    const entries = Array.from({ length: BOARDS_PER_MESSAGE + 3 }, (_, i) => board(i));
    const messages = toCrawlMessages(entries);
    expect(messages.map((m) => m.boards.length)).toEqual([BOARDS_PER_MESSAGE, 3]);
    expect(messages[0]?.boards[0]).toBe("greenhouse/board0");
  });
});

describe("enqueueBoards", () => {
  it("sends every message and reports how many", async () => {
    const queue = fakeQueue();
    const sent = await enqueueBoards(queue, [board(0), board(1)]);
    expect(sent).toBe(1);
    expect(queue.sendBatch).toHaveBeenCalledWith([
      { body: { boards: ["greenhouse/board0", "greenhouse/board1"] } },
    ]);
  });
});

describe("handleCrawlBatch", () => {
  beforeEach(() => {
    crawlAllMock.mockReset();
  });

  it("crawls known boards, keyed by provider, and acks the message", async () => {
    crawlAllMock.mockResolvedValue(runOf("greenhouse/a", "lever/b"));
    const queue = fakeQueue();
    const batch = batchOf({ boards: ["greenhouse/a", "lever/b", "lever/gone"] });

    await handleCrawlBatch(batch, queue);

    const crawled = crawlAllMock.mock.calls[0]?.[0] as { name: string }[];
    expect(crawled.map((entry) => entry.name)).toEqual(["a", "b"]);
    expect(batch.messages[0]?.ack).toHaveBeenCalled();
    expect(queue.sendBatch).not.toHaveBeenCalled();
  });

  it("re-enqueues boards the subrequest budget could not reach", async () => {
    crawlAllMock.mockResolvedValue(runOf("greenhouse/a"));
    const queue = fakeQueue();
    await handleCrawlBatch(batchOf({ boards: ["greenhouse/a", "lever/b", "ashby/c"] }), queue);
    expect(queue.sendBatch).toHaveBeenCalledWith([{ body: { boards: ["lever/b", "ashby/c"] } }]);
  });
});
