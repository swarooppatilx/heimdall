import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFacetOptionsCached,
  getRecentJobLinksCached,
  warmJobViews,
} from "@/server/jobs/cached-views";

const { getRecentJobs, getCompanyIndex, getFacetOptions } = vi.hoisted(() => ({
  getRecentJobs: vi.fn(),
  getCompanyIndex: vi.fn(),
  getFacetOptions: vi.fn(),
}));

vi.mock("@/server/jobs/queries", () => ({ getRecentJobs, getCompanyIndex }));
vi.mock("@/server/jobs/facets", () => ({ getFacetOptions }));

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn((key: string, opts?: { type?: string }) => {
      const raw = store.get(key);
      if (raw === undefined) return Promise.resolve(null);
      return Promise.resolve(opts?.type === "json" ? JSON.parse(raw) : raw);
    }),
    put: vi.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
  };
}

function envWith(kv: ReturnType<typeof fakeKv>) {
  return { CACHE: kv as unknown as KVNamespace };
}

const facets = { countries: [] };
const recent = [
  {
    id: "1",
    title: "Engineer",
    company: "acme",
    location: "remote",
    department: "engineering",
    url: "https://example.com/1",
    postedAt: new Date("2026-09-20"),
    source: "greenhouse",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getRecentJobs.mockResolvedValue(recent);
  getCompanyIndex.mockResolvedValue([{ name: "acme", lastPostedAt: "2026-09-20T00:00:00.000Z" }]);
  getFacetOptions.mockResolvedValue(facets);
});

describe("getFacetOptionsCached", () => {
  it("reads through to the database once and serves later reads from KV", async () => {
    const env = envWith(fakeKv());
    await expect(getFacetOptionsCached(env)).resolves.toEqual(facets);
    await expect(getFacetOptionsCached(env)).resolves.toEqual(facets);
    expect(getFacetOptions).toHaveBeenCalledTimes(1);
  });

  it("falls back to the database when KV errors", async () => {
    const kv = fakeKv();
    kv.get.mockRejectedValueOnce(new Error("kv down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getFacetOptionsCached(envWith(kv))).resolves.toEqual(facets);
  });
});

describe("warmJobViews", () => {
  it("stores only small derived views, never the full job table", async () => {
    const kv = fakeKv();
    await warmJobViews(envWith(kv), { full: true });
    expect([...kv.store.keys()].sort()).toEqual([
      "company-index",
      "facet-options:v2",
      "recent-jobs:v2",
    ]);
    expect(JSON.parse(kv.store.get("recent-jobs:v2") ?? "[]")).toEqual([
      {
        title: "Engineer",
        company: "acme",
        url: "https://example.com/1",
        location: "remote",
        postedAt: "2026-09-20T00:00:00.000Z",
      },
    ]);
  });

  it("rebuilds only the cheap recent-jobs view between sweeps", async () => {
    const kv = fakeKv();
    await warmJobViews(envWith(kv), { full: false });

    expect([...kv.store.keys()]).toEqual(["recent-jobs:v2"]);
    expect(getFacetOptions).not.toHaveBeenCalled();
    expect(getCompanyIndex).not.toHaveBeenCalled();
  });

  it("lets readers skip the database once warmed", async () => {
    const env = envWith(fakeKv());
    await warmJobViews(env, { full: true });
    getRecentJobs.mockClear();
    await expect(getRecentJobLinksCached(env)).resolves.toHaveLength(1);
    expect(getRecentJobs).not.toHaveBeenCalled();
  });
});
