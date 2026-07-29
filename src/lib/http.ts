const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const BACKOFF_MULTIPLIER = 2;
const FIRST_RETRY_ATTEMPT = 2;

export interface CrawlBudget {
  used: number;
}

export function createCrawlBudget(): CrawlBudget {
  return { used: 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (attempt > 1) {
      await sleep(RETRY_BASE_MS * BACKOFF_MULTIPLIER ** (attempt - FIRST_RETRY_ATTEMPT));
    }
    try {
      if (budget) budget.used += 1;
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return (await res.json()) as T;
      lastError = new Error(`Failed to fetch jobs from ${source}: ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
