const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const BACKOFF_MULTIPLIER = 2;
const FIRST_RETRY_ATTEMPT = 2;
const JITTER_MS = 250;
const MAX_BODY_SIZE = 20_971_520;
const MS_PER_SECOND = 1_000;

export interface CrawlBudget {
  used: number;
}

export function createCrawlBudget(): CrawlBudget {
  return { used: 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, retryAfterMs?: number): number {
  const base = RETRY_BASE_MS * BACKOFF_MULTIPLIER ** (attempt - FIRST_RETRY_ATTEMPT);
  const jitter = Math.floor(Math.random() * JITTER_MS);
  if (retryAfterMs !== undefined && retryAfterMs > base) return retryAfterMs + jitter;
  return base + jitter;
}

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isNaN(seconds) ? undefined : seconds * MS_PER_SECOND;
}

async function parseJson<T>(res: Response, source: string): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new Error(`Unexpected content-type from ${source}: ${contentType || "none"}`);
  }
  const length = Number.parseInt(res.headers.get("content-length") ?? "", 10);
  if (!Number.isNaN(length) && length > MAX_BODY_SIZE) {
    res.body?.cancel();
    throw new Error(`Response from ${source} too large: ${length} bytes`);
  }
  const text = await res.text();
  if (text.length > MAX_BODY_SIZE) {
    throw new Error(`Response body from ${source} too large: ${text.length} bytes`);
  }
  return JSON.parse(text) as T;
}

export async function fetchJson<T>(
  url: string,
  source: string,
  init?: RequestInit,
  timeoutMs = TIMEOUT_MS,
  budget?: CrawlBudget,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let delayMs: number | undefined;
    if (attempt > 1) await sleep(backoffDelay(attempt, delayMs));
    try {
      if (budget) budget.used += 1;
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await parseJson<T>(res, source);
      lastError = new Error(`Failed to fetch jobs from ${source}: ${res.status}`);
      delayMs = retryAfterMs(res);
      res.body?.cancel();
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
