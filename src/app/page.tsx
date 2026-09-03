"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react";
import { Header } from "@/components/header";
import { JobCard } from "@/components/jobs/job-card";
import { JobCardSkeleton } from "@/components/jobs/job-card-skeleton";
import { JobFilters } from "@/components/jobs/job-filters";
import { ResultsToolbar } from "@/components/jobs/results-toolbar";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useJobAnnouncement } from "@/hooks/use-job-announcement";
import { useJobFilters } from "@/hooks/use-job-filters";
import { useLocationOptions } from "@/hooks/use-location-options";
import { useQueryParam } from "@/hooks/use-query-param";
import { useSearchShortcut } from "@/hooks/use-search-shortcut";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { dedupeJobs } from "@/lib/job";
import type { FacetOptions } from "@/modules/jobs/facets";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const SEARCH_DEBOUNCE_MS = 300;

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-destructive/40 p-8 text-center">
      <p className="text-sm text-muted-foreground">something went wrong fetching jobs</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4">
        try again
      </Button>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">no roles match these filters</p>
      {Boolean(hasFilters) && (
        <Button type="button" variant="outline" size="sm" onClick={onClear} className="mt-4">
          clear all filters
        </Button>
      )}
    </div>
  );
}

function resolveCountLabel(
  isLoading: boolean,
  isError: boolean,
  total: number,
  jobsShown: number,
  dedupedCount: number,
): string {
  if (isLoading) return "loading...";
  if (isError) return "something went wrong fetching jobs — try again";
  if (total > jobsShown) return `showing ${dedupedCount} of ${total} fresh roles`;
  return `${dedupedCount} fresh role${dedupedCount === 1 ? "" : "s"}`;
}

function JobsPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery, commitQuery] = useQueryParam("q", "", { deferCommit: true });
  const [company, setCompany] = useQueryParam("company", "");
  const [location, setLocation] = useQueryParam("location", "");
  const [experience, setExperience] = useQueryParam("experience", "");
  const [posted, setPosted] = useQueryParam("posted", "");
  const [source, setSource] = useQueryParam("source", "");
  const [department, setDepartment] = useQueryParam("department", "");
  const [sort, setSort] = useQueryParam("sort", "");
  const deferredQuery = useDeferredValue(query);
  const debouncedQuery = useDebouncedValue(deferredQuery, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    commitQuery(debouncedQuery);
  }, [commitQuery, debouncedQuery]);

  const filters = {
    q: debouncedQuery,
    company,
    location,
    experience,
    posted,
    source,
    department,
    sort,
  };

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFilters(filters);
  const jobs = useMemo(() => data?.pages.flatMap((p) => p.jobs) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const sentinelRef = useInfiniteScroll(fetchNextPage, hasNextPage, isFetchingNextPage);

  const jobCards = useMemo(
    () => dedupeJobs(jobs, (job) => `${job.company}|${job.title.toLowerCase()}`),
    [jobs],
  );

  const { data: filterOptions } = useQuery<FacetOptions>({
    queryKey: ["filters"],
    queryFn: async () => {
      const res = await fetch("/api/filters");
      if (!res.ok) throw new Error(`filters request failed: ${res.status}`);
      return res.json() as Promise<FacetOptions>;
    },
  });

  useSearchShortcut(searchRef, setQuery);

  const clearAllFilters = useCallback(() => {
    setQuery("");
    setCompany("");
    setLocation("");
    setExperience("");
    setPosted("");
    setSource("");
    setDepartment("");
    commitQuery("");
    router.replace("?", { scroll: false });
  }, [
    commitQuery,
    router,
    setQuery,
    setCompany,
    setLocation,
    setExperience,
    setPosted,
    setSource,
    setDepartment,
  ]);

  const advancedCount = [experience, source].filter(Boolean).length;
  const locationOptions = useLocationOptions(filterOptions);
  const hasFilters = Boolean(company || location || source || department || experience || posted);
  const { syncedAt, syncStale } = useSyncStatus();
  const countLabel = resolveCountLabel(isLoading, isError, total, jobs.length, jobCards.length);
  const announcement = useJobAnnouncement(isLoading, isError, countLabel);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#job-results"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
      >
        Skip to results
      </a>
      <Header />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <JobFilters
          query={query}
          setQuery={setQuery}
          searchRef={searchRef}
          company={company}
          setCompany={setCompany}
          department={department}
          setDepartment={setDepartment}
          location={location}
          setLocation={setLocation}
          locationOptions={locationOptions}
          posted={posted}
          setPosted={setPosted}
          filterOptions={filterOptions}
        />

        <ResultsToolbar
          countLabel={announcement}
          syncedAt={syncedAt}
          syncStale={syncStale}
          hasFilters={hasFilters}
          advancedCount={advancedCount}
          filterOptions={filterOptions}
          experience={experience}
          onExperienceChange={setExperience}
          source={source}
          onSourceChange={setSource}
          onClearAll={clearAllFilters}
          sort={sort}
          onSortChange={setSort}
        />
        {Boolean(isError) && <ErrorState onRetry={() => refetch()} />}
        {!(isError || isLoading) && jobCards.length === 0 && (
          <EmptyState hasFilters={hasFilters} onClear={clearAllFilters} />
        )}

        {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor target for the skip link */}
        <ul id="job-results" tabIndex={-1} className="flex flex-col gap-2">
          {Boolean(isLoading) && SKELETON_KEYS.map((key) => <JobCardSkeleton key={key} />)}
          {!isLoading &&
            jobCards.map(({ job, openings }) => (
              <JobCard key={job.id} job={job} openings={openings} />
            ))}
          {Boolean(isFetchingNextPage) &&
            ["s1", "s2", "s3", "s4"].map((key) => <JobCardSkeleton key={key} />)}
        </ul>

        {Boolean(hasNextPage) && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <JobsPage />
    </Suspense>
  );
}
