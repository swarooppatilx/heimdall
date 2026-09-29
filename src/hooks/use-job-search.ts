"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { useFilterParams } from "@/hooks/use-filter-params";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { type JobPage, useJobsQuery } from "@/hooks/use-jobs-query";
import { useSearchShortcut } from "@/hooks/use-search-shortcut";
import { useSyncStatus } from "@/hooks/use-sync-status";
import type { FacetOptions } from "@/lib/api-types";
import { dedupeJobs, dedupeKey } from "@/lib/job";
import { COUNT_CAP, type HomeFilters } from "@/lib/search-params";

export interface HomeInitialData {
  filters: HomeFilters;
  page?: JobPage;
  facets?: FacetOptions;
}

function countLabel(total: number): string {
  const totalLabel = total >= COUNT_CAP ? `${COUNT_CAP}+` : String(total);
  return `${totalLabel} fresh job${total === 1 ? "" : "s"}`;
}

function resultsLabel(state: { isLoading: boolean; isError: boolean; total: number }): string {
  if (state.isError) return "";
  if (state.isLoading) return "loading…";
  // The empty state already says nothing matched.
  if (state.total === 0) return "";
  return countLabel(state.total);
}

function locationOptions(facets: FacetOptions | undefined): string[] {
  if (!facets) return ["remote"];
  const countries = [...facets.countries].sort((a, b) => b.count - a.count);
  const cities = countries
    .flatMap((country) =>
      country.cities.map((city) => ({
        value: `${city.value}, ${country.value}`,
        count: city.count,
      })),
    )
    .sort((a, b) => b.count - a.count);
  return ["remote", ...countries.map((c) => c.value), ...cities.map((c) => c.value)];
}

export function useJobSearch(initial: HomeInitialData) {
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchRef);

  const { filters, setFilter, clearFilters, query, setQuery } = useFilterParams(initial.filters);
  const {
    data,
    isLoading,
    isError,
    isPlaceholderData,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useJobsQuery(
    filters,
    initial.page ? { filters: initial.filters, page: initial.page } : undefined,
  );

  const jobs = useMemo(() => data?.pages.flatMap((page) => page.jobs) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;
  const jobCards = useMemo(() => dedupeJobs(jobs, dedupeKey), [jobs]);
  const loadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);
  const sentinelRef = useInfiniteScroll(
    loadMore,
    hasNextPage && !isFetchingNextPage && !isFetchNextPageError,
  );

  const { data: facets } = useQuery<FacetOptions>({
    queryKey: ["filters"],
    initialData: () => initial.facets,
    queryFn: async () => {
      const res = await fetch("/api/filters");
      if (!res.ok) throw new Error(`filters request failed: ${res.status}`);
      return res.json() as Promise<FacetOptions>;
    },
  });
  const locations = useMemo(() => locationOptions(facets), [facets]);
  const sync = useSyncStatus();

  return {
    query,
    setQuery,
    searchRef,
    filters,
    setFilter,
    clearFilters,
    facets,
    locationOptions: locations,
    countLabel: resultsLabel({ isLoading, isError, total }),
    isUpdating: isPlaceholderData,
    sync,
    results: {
      jobCards,
      isLoading,
      isUpdating: isPlaceholderData,
      isError,
      isFetchingNextPage,
      hasNextPage,
      loadMoreFailed: isFetchNextPageError,
      sentinelRef,
      onRetry: () => refetch(),
      onLoadMore: loadMore,
    },
  };
}
