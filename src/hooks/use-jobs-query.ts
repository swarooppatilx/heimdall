"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { JobDto } from "@/lib/job";
import {
  COUNT_CAP,
  DEFAULT_LIMIT,
  HOME_FILTER_KEYS,
  type HomeFilters,
  MAX_OFFSET,
} from "@/lib/search-params";

export interface JobPage {
  jobs: JobDto[];
  /** Sent with the first page only. */
  total: number | null;
}

// A short page means the list is done. So does reaching an exact total (it
// saves one empty request; a capped "1000+" can't be trusted for that), or the
// deepest offset the API serves.
export function nextOffset(lastPage: JobPage, allPages: JobPage[]): number | undefined {
  if (lastPage.jobs.length < DEFAULT_LIMIT) return undefined;
  const loaded = allPages.length * DEFAULT_LIMIT;
  const total = allPages[0]?.total ?? null;
  if (total !== null && total < COUNT_CAP && loaded >= total) return undefined;
  if (loaded > MAX_OFFSET) return undefined;
  return loaded;
}

function sameFilters(a: HomeFilters, b: HomeFilters): boolean {
  return HOME_FILTER_KEYS.every((key) => a[key] === b[key]);
}

export function useJobsQuery(
  filters: HomeFilters,
  initial?: { filters: HomeFilters; page: JobPage },
) {
  const initialData =
    initial && sameFilters(filters, initial.filters)
      ? { pages: [initial.page], pageParams: [0] }
      : undefined;

  return useInfiniteQuery({
    queryKey: ["jobs", filters],
    queryFn: async ({ pageParam, signal }): Promise<JobPage> => {
      const params = new URLSearchParams();
      for (const key of HOME_FILTER_KEYS) {
        if (filters[key]) params.set(key, filters[key]);
      }
      if (pageParam) params.set("offset", String(pageParam));
      params.set("limit", String(DEFAULT_LIMIT));
      // Aborted when a newer search replaces this one.
      const res = await fetch(`/api/jobs?${params}`, { signal });
      if (!res.ok) {
        throw new Error(`jobs request failed: ${res.status}`);
      }
      const jobs = (await res.json()) as JobDto[];
      const total = res.headers.get("X-Total-Count");
      return { jobs, total: total === null ? null : Number(total) };
    },
    initialData: () => initialData,
    // Old results stay on screen while the next filter loads; callers read
    // isPlaceholderData so the count and list don't claim they are current.
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });
}
