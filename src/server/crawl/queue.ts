import { chunk } from "@/lib/chunk";
import { createCrawlBudget } from "@/server/crawl/http";
import { type CrawlRun, crawlAll } from "@/server/crawl/scheduler";
import { boardKey, getSourcesByKeys, type Source } from "@/server/crawl/sources";
import { logEvent } from "@/server/logger";

// Eight boards stay well inside one invocation's subrequest budget, including
// retries and SmartRecruiters pagination.
export const BOARDS_PER_MESSAGE = 8;
// Queues accepts at most 100 messages per sendBatch call.
const MESSAGES_PER_SEND = 100;

export interface CrawlMessage {
  boards: string[];
}

export function toCrawlMessages(entries: Source[]): CrawlMessage[] {
  return chunk(entries.map(boardKey), BOARDS_PER_MESSAGE).map((boards) => ({ boards }));
}

export async function enqueueBoards(
  queue: Queue<CrawlMessage>,
  entries: Source[],
): Promise<number> {
  const messages = toCrawlMessages(entries);
  for (const page of chunk(messages, MESSAGES_PER_SEND)) {
    await queue.sendBatch(page.map((body) => ({ body })));
  }
  return messages.length;
}

/**
 * Crawls each message's boards with a fresh subrequest budget. Boards the
 * budget could not reach go back on the queue; board failures are recorded by
 * the pipeline and retried on the next sweep, so messages are always acked.
 */
export async function handleCrawlBatch(
  batch: MessageBatch<CrawlMessage>,
  queue: Queue<CrawlMessage>,
): Promise<CrawlRun[]> {
  const keys = batch.messages.flatMap((message) => message.body.boards);
  const registry = new Map((await getSourcesByKeys(keys)).map((entry) => [boardKey(entry), entry]));
  const runs: CrawlRun[] = [];

  for (const message of batch.messages) {
    const entries = message.body.boards.flatMap((key) => {
      const entry = registry.get(key);
      if (!entry) logEvent("crawl_unknown_board", { board: key });
      return entry ? [entry] : [];
    });

    const run = await crawlAll(entries, createCrawlBudget());
    const crawled = new Set(run.results.map((result) => result.board));
    const leftover = entries.filter((entry) => !crawled.has(boardKey(entry)));
    if (leftover.length > 0) await enqueueBoards(queue, leftover);

    runs.push(run);
    message.ack();
  }
  return runs;
}
