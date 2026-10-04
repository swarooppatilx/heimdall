import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCrawlBudget,
  type FetchJsonOptions,
  fetchJsonWithHeaders,
} from "@/server/crawl/http";

async function fetchJson(url: string, source: string, options?: FetchJsonOptions) {
  return (await fetchJsonWithHeaders(url, source, options)).data;
}

describe("fetchJsonWithHeaders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns parsed json on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: 1 })));
    await expect(fetchJson("/x", "test")).resolves.toEqual({ ok: 1 });
  });

  it("charges every attempt to the budget", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const budget = createCrawlBudget();

    const pending = fetchJson("/x", "test", { budget });
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ ok: 1 });
    expect(budget.used).toBe(2);
  });

  it("retries transient server errors and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchJson("/x", "test");
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent client errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("/x", "test")).rejects.toThrow("404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after the final attempt and reports the last error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("down", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const pending = fetchJson("/x", "test");
    const assertion = expect(pending).rejects.toThrow("500");
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("waits between attempts with exponential backoff", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("down", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const startedAt = Date.now();
    const pending = fetchJson("/x", "test");
    const assertion = expect(pending).rejects.toThrow("500");
    await vi.runAllTimersAsync();
    await assertion;

    const elapsed = Date.now() - startedAt;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(elapsed).toBeGreaterThanOrEqual(1500);
    expect(elapsed).toBeLessThanOrEqual(2000);
  });
});

describe("crawler identity", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("identifies the crawler with a contact URL unless the caller sets its own agent", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(Response.json({ ok: 1 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchJson("/x", "test");
    await fetchJson("/x", "test", { init: { headers: { "User-Agent": "custom" } } });

    const agent = (call: number) =>
      new Headers(fetchMock.mock.calls[call]?.[1]?.headers).get("user-agent");
    expect(agent(0)).toMatch(/^heimdall \(\+https?:\/\//);
    expect(agent(1)).toBe("custom");
  });
});

describe("conditional requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(response: () => Response) {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response()));
    vi.stubGlobal("fetch", fetchMock);
    return (name: string) => new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get(name);
  }

  it("sends a stored ETag as If-None-Match", async () => {
    const header = stubFetch(() => Response.json({ ok: 1 }));

    await fetchJsonWithHeaders("/x", "test", { validator: 'W/"abc"' });

    expect(header("if-none-match")).toBe('W/"abc"');
    expect(header("if-modified-since")).toBeNull();
  });

  it("sends a stored date as If-Modified-Since", async () => {
    const header = stubFetch(() => Response.json({ ok: 1 }));

    await fetchJsonWithHeaders("/x", "test", { validator: "Wed, 01 Oct 2026 10:00:00 GMT" });

    expect(header("if-modified-since")).toBe("Wed, 01 Oct 2026 10:00:00 GMT");
    expect(header("if-none-match")).toBeNull();
  });

  it("records the ETag a response sends, ahead of Last-Modified", async () => {
    stubFetch(() =>
      Response.json(
        { ok: 1 },
        { headers: { etag: '"v2"', "last-modified": "Wed, 01 Oct 2026 10:00:00 GMT" } },
      ),
    );

    const result = await fetchJsonWithHeaders("/x", "test");

    expect(result.validator).toBe('"v2"');
  });

  it("keeps the stored validator when the server answers 304", async () => {
    stubFetch(() => new Response(null, { status: 304 }));

    const result = await fetchJsonWithHeaders("/x", "test", { validator: '"v1"' });

    expect(result).toEqual({ data: undefined, validator: '"v1"' });
  });
});
