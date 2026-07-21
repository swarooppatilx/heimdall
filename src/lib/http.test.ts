import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./http";

describe("fetchJson", () => {
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

    expect(Date.now() - startedAt).toBe(1500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
