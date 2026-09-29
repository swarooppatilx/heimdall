import type { ZodSchema } from "zod";
import { siteConfig } from "@/lib/site";
import { MS_PER_SECOND } from "@/lib/time";

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;
const BACKOFF_MULTIPLIER = 2;
const FIRST_RETRY_ATTEMPT = 2;
const JITTER_MS = 250;
const STATUS_SERVER_ERROR = 500;
const STATUS_NOT_MODIFIED = 304;
const STATUS_TOO_MANY_REQUESTS = 429;
// 4 MiB. A parsed JSON body takes several times its text size in memory, so
// this keeps the largest boards well inside the isolate's 128 MB.
const MAX_BODY_SIZE = 4_194_304;
// Identifies the crawler to ATS hosts, with a URL to reach whoever runs it.
const CRAWLER_USER_AGENT = `heimdall (+${siteConfig.url})`;

export interface CrawlBudget {
  used: number;
}

const EXTERNAL_SUBREQUEST_LIMIT = 50;
const SUBREQUEST_HEADROOM = 15;

export function createCrawlBudget(): CrawlBudget {
  return { used: 0 };
}

export function hasBudgetLeft(budget: CrawlBudget): boolean {
  return budget.used < EXTERNAL_SUBREQUEST_LIMIT - SUBREQUEST_HEADROOM;
}

/**
 * D1 calls share the per-invocation subrequest limit with fetches (50 on the
 * Free plan), so each round trip, a query or one batch, is charged here.
 */
export function chargeD1(budget: CrawlBudget | undefined, calls: number): void {
  if (budget) budget.used += calls;
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

async function parseJson<T>(res: Response, source: string, schema?: ZodSchema<T>): Promise<T> {
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
  const parsed: unknown = JSON.parse(text);
  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Invalid response from ${source}: ${result.error.issues.map((i) => i.message).join(", ")}`,
      );
    }
    return result.data;
  }
  return parsed as T;
}

export interface FetchJsonOptions<T = unknown> {
  init?: RequestInit;
  timeoutMs?: number;
  budget?: CrawlBudget;
  schema?: ZodSchema<T>;
  ifModifiedSince?: string;
}

export interface FetchJsonResult<T> {
  data: T | undefined;
  lastModified: string | null;
}

export async function fetchJsonWithHeaders<T>(
  url: string,
  source: string,
  options?: FetchJsonOptions<T>,
): Promise<FetchJsonResult<T>> {
  const { init, timeoutMs = TIMEOUT_MS, budget, schema, ifModifiedSince } = options ?? {};
  let lastError: unknown;
  let prevRetryAfter: number | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 1) await sleep(backoffDelay(attempt, prevRetryAfter));
    try {
      if (budget) budget.used += 1;
      const headers = new Headers(init?.headers);
      if (ifModifiedSince) headers.set("If-Modified-Since", ifModifiedSince);
      if (!headers.has("User-Agent")) headers.set("User-Agent", CRAWLER_USER_AGENT);
      const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === STATUS_NOT_MODIFIED) {
        res.body?.cancel();
        return { data: undefined, lastModified: ifModifiedSince ?? null };
      }
      if (res.ok) {
        const data = await parseJson<T>(res, source, schema);
        return { data, lastModified: res.headers.get("last-modified") };
      }
      lastError = new Error(`Failed to fetch jobs from ${source}: ${res.status}`);
      prevRetryAfter = retryAfterMs(res);
      res.body?.cancel();
      if (res.status < STATUS_SERVER_ERROR && res.status !== STATUS_TOO_MANY_REQUESTS) break;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
