import { NextResponse } from "next/server";
import { upsertJobs } from "@/lib/db";
import { fetchJobs } from "@/lib/fetch-jobs";
import { getRegistry } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function POST() {
  const registry = getRegistry();
  const results = await Promise.allSettled(registry.map((entry) => fetchJobs(entry)));

  let total = 0;
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const entry = registry[i];

    if (result.status === "fulfilled") {
      upsertJobs(result.value);
      total += result.value.length;
    } else {
      errors.push(`${entry.name}: ${result.reason}`);
    }
  }

  return NextResponse.json({ synced: total, errors });
}
