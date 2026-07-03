const TIMEOUT_MS = 10_000;

export async function fetchJson<T>(url: string, source: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${source}: ${res.status}`);
  }
  return (await res.json()) as T;
}
