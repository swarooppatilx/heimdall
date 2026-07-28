import { beforeEach, describe, expect, it, vi } from "vitest";

const kvStore = new Map<string, string>();
const kvGet = vi.fn(async (key: string, options?: { type?: "json" }) => {
  const raw = kvStore.get(key);
  if (raw == null) return null;
  return options?.type === "json" ? (JSON.parse(raw) as unknown) : raw;
});
const kvPut = vi.fn(async (key: string, value: string) => {
  kvStore.set(key, value);
});

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: { CACHE: { get: kvGet, put: kvPut } },
  }),
}));

const dbFacets = { remoteCount: 7, countries: [] };
const dbGet = vi.fn(async () => dbFacets);

vi.mock("./facets", () => ({
  getFacetOptions: () => dbGet(),
}));

import { getFacetOptionsCached } from "./facet-cache";

beforeEach(() => {
  kvStore.clear();
  kvGet.mockClear();
  kvPut.mockClear();
  dbGet.mockClear();
});

describe("getFacetOptionsCached", () => {
  it("reads through to the database and populates the cache", async () => {
    await expect(getFacetOptionsCached()).resolves.toBe(dbFacets);
    expect(dbGet).toHaveBeenCalledTimes(1);
    expect(kvPut).toHaveBeenCalledWith("facet-options", JSON.stringify(dbFacets), {
      expirationTtl: 3600,
    });
  });

  it("serves subsequent reads from the cache without touching the database", async () => {
    await getFacetOptionsCached();
    const second = await getFacetOptionsCached();
    expect(second).toEqual(dbFacets);
    expect(dbGet).toHaveBeenCalledTimes(1);
    expect(kvGet).toHaveBeenCalledTimes(2);
  });

  it("falls back to the database when the cache errors", async () => {
    kvGet.mockRejectedValueOnce(new Error("kv down"));
    await expect(getFacetOptionsCached()).resolves.toBe(dbFacets);
    expect(dbGet).toHaveBeenCalledTimes(1);
  });
});
