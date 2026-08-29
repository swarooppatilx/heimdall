"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import type { Job } from "@/lib/job";

const PAGE_SIZE = 50;

export interface JobFiltersInput {
  q: string;
  company: string;
  location: string;
  experience: string;
  posted: string;
  source: string;
  department: string;
  sort: string;
}

export interface JobPage {
  jobs: Job[];
  total: number;
}

export function useJobFilters(filters: JobFiltersInput) {
  return useInfiniteQuery({
    queryKey: ["jobs", filters],
    queryFn: async ({ pageParam }): Promise<JobPage> => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.company) params.set("company", filters.company);
      if (filters.location) params.set("location", filters.location);
      if (filters.experience) params.set("experience", filters.experience);
      if (filters.posted) params.set("posted", filters.posted);
      if (filters.source) params.set("source", filters.source);
      if (filters.department) params.set("department", filters.department);
      if (filters.sort) params.set("sort", filters.sort);
      if (pageParam) params.set("offset", String(pageParam));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/jobs?${params}`);
      if (!res.ok) {
        throw new Error(`jobs request failed: ${res.status}`);
      }
      const jobs = (await res.json()) as Job[];
      return { jobs, total: Number(res.headers.get("X-Total-Count") ?? 0) };
    },
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.jobs.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
}
