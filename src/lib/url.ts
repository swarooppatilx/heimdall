const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/** True for absolute http(s) URLs; job links render as hrefs, so nothing else is allowed. */
export function isHttpUrl(url: string): boolean {
  try {
    return HTTP_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}
