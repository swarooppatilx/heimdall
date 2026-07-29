import { beforeEach, describe, expect, it, vi } from "vitest";

const getCloudflareContext = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => getCloudflareContext(),
}));

async function freshModule() {
  vi.resetModules();
  return await import("./db-connection");
}

beforeEach(() => {
  getCloudflareContext.mockReset();
});

describe("getDb", () => {
  it("reinitializes after a failed connection attempt", async () => {
    const mod = await freshModule();
    getCloudflareContext.mockRejectedValueOnce(new Error("context unavailable"));

    await expect(mod.getDb()).rejects.toThrow("context unavailable");

    getCloudflareContext.mockResolvedValue({ env: { DB: {} } });
    const db = await mod.getDb();
    expect(db).toBeDefined();
    expect(getCloudflareContext).toHaveBeenCalledTimes(2);
  });

  it("reuses the same connection across calls", async () => {
    const mod = await freshModule();
    getCloudflareContext.mockResolvedValue({ env: { DB: {} } });

    const first = await mod.getDb();
    const second = await mod.getDb();
    expect(second).toBe(first);
    expect(getCloudflareContext).toHaveBeenCalledTimes(1);
  });
});
