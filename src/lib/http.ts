const TIMEOUT_MS = 10_000;

export async function fetchJson<T>(
  url: string,
  source: string,
  init?: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${source}: ${res.status}`);
  }
  return (await res.json()) as T;
}
