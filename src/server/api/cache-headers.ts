export const JOBS_CACHE_TAG = "jobs";

const BROWSER_MAX_AGE_SECONDS = 60;
const EDGE_MAX_AGE_SECONDS = 3600;
const STALE_WHILE_REVALIDATE_SECONDS = 300;

function cacheControl(edgeSeconds: number, browserSeconds: number): string {
  return `public, max-age=${browserSeconds}, s-maxage=${edgeSeconds}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;
}

/**
 * Job-derived responses stay in the Workers edge cache for up to an hour;
 * the cron purges the `jobs` tag whenever a crawl changes data.
 */
export function setJobsCacheHeaders(headers: Headers, browserSeconds = BROWSER_MAX_AGE_SECONDS) {
  headers.set("Cache-Control", cacheControl(EDGE_MAX_AGE_SECONDS, browserSeconds));
  headers.set("Cache-Tag", JOBS_CACHE_TAG);
}

export function withCacheHeaders<T extends Response>(response: T): T {
  setJobsCacheHeaders(response.headers);
  return response;
}

/** Short-lived edge caching for responses that change every tick and are not purged. */
export function withShortCacheHeaders<T extends Response>(response: T, seconds: number): T {
  response.headers.set("Cache-Control", cacheControl(seconds, seconds));
  return response;
}

export function withNoStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
