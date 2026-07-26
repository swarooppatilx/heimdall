"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react";
import { FilterSelect } from "@/components/filter-select";
import { ActiveFilterChips } from "@/components/jobs/active-filter-chips";
import { JobCard } from "@/components/jobs/job-card";
import { JobCardSkeleton } from "@/components/jobs/job-card-skeleton";
import { MoreFiltersPopover } from "@/components/jobs/more-filters-popover";
import { SortMenu } from "@/components/jobs/sort-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useJobFilters } from "@/hooks/use-job-filters";
import { useQueryParam } from "@/hooks/use-query-param";
import type { FacetOptions } from "@/lib/db";
import type { Job } from "@/lib/job";
import { timeAgo } from "@/lib/time-ago";

interface CrawlStatusEntry {
  company: string;
  status: string;
  jobsFound: number;
  durationMs: number;
  createdAt: string;
}

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const HOURS_PER_DAY = 24;
const MS_PER_HOUR = 3_600_000;
const STALE_SYNC_MS = HOURS_PER_DAY * MS_PER_HOUR;
const SKELETON_PRELOAD_COUNT = 4;

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
  const [employmentType, setEmploymentType] = useQueryParam("employment_type", "");
  const [sort, setSort] = useQueryParam("sort", "");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    commitQuery(deferredQuery);
  }, [commitQuery, deferredQuery]);

  const filters = {
    q: deferredQuery,
    company,
    location,
    experience,
    posted,
    source,
    department,
    employmentType,
    sort,
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFilters(filters);
  const jobs = useMemo(() => data?.pages.flatMap((p) => p.jobs) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const jobCards = useMemo(() => {
    const primary = new Map<string, Job>();
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const key = `${job.company}|${job.title.toLowerCase()}`;
      if (!primary.has(key)) primary.set(key, job);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...primary.entries()].map(([key, job]) => ({
      key,
      job,
      openings: counts.get(key) ?? 1,
    }));
  }, [jobs]);

  const { data: filterOptions } = useQuery<FacetOptions>({
    queryKey: ["filters"],
    queryFn: async () => {
      const res = await fetch("/api/filters");
      if (!res.ok) {
        throw new Error(`filters request failed: ${res.status}`);
      }
      return res.json() as Promise<FacetOptions>;
    },
  });

  const { data: crawlStatus } = useQuery<{ latest: CrawlStatusEntry[] }>({
    queryKey: ["crawlStatus"],
    queryFn: async () => {
      const res = await fetch("/api/crawl/status");
      if (!res.ok) {
        throw new Error(`crawl status request failed: ${res.status}`);
      }
      return res.json() as Promise<{ latest: CrawlStatusEntry[] }>;
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setQuery]);

  const clearAllFilters = useCallback(() => {
    setQuery("");
    setCompany("");
    setLocation("");
    setExperience("");
    setPosted("");
    setSource("");
    setDepartment("");
    setEmploymentType("");
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
    setEmploymentType,
  ]);

  const advancedCount = [experience, source, employmentType].filter(Boolean).length;

  const locationOptions = useMemo(() => {
    if (!filterOptions) return ["remote"];
    const countries = [...filterOptions.countries].sort((a, b) => b.count - a.count);
    const cities = countries
      .flatMap((c) => c.cities.map((t) => ({ value: `${t.value}, ${c.value}`, count: t.count })))
      .sort((a, b) => b.count - a.count);
    return ["remote", ...countries.map((c) => c.value), ...cities.map((t) => t.value)];
  }, [filterOptions]);

  const chips = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];
    if (company)
      list.push({ key: "company", label: `company: ${company}`, onRemove: () => setCompany("") });
    if (location)
      list.push({
        key: "location",
        label: `location: ${location}`,
        onRemove: () => setLocation(""),
      });
    if (source)
      list.push({ key: "source", label: `source: ${source}`, onRemove: () => setSource("") });
    if (department)
      list.push({
        key: "department",
        label: `department: ${department}`,
        onRemove: () => setDepartment(""),
      });
    if (employmentType)
      list.push({
        key: "employmentType",
        label: `type: ${employmentType}`,
        onRemove: () => setEmploymentType(""),
      });
    if (experience)
      list.push({
        key: "experience",
        label: `seniority: ${experience}`,
        onRemove: () => setExperience(""),
      });
    if (posted)
      list.push({
        key: "posted",
        label: `posted: ${posted === "week" ? "this week" : posted}`,
        onRemove: () => setPosted(""),
      });
    return list;
  }, [
    company,
    location,
    source,
    department,
    experience,
    posted,
    employmentType,
    setCompany,
    setLocation,
    setSource,
    setDepartment,
    setEmploymentType,
    setExperience,
    setPosted,
  ]);

  const syncedAt = crawlStatus?.latest?.[0]?.createdAt;
  const syncStale = syncedAt ? Date.now() - new Date(syncedAt).getTime() > STALE_SYNC_MS : false;

  const countLabel = isLoading
    ? "loading..."
    : isError
      ? "something went wrong fetching jobs — try again"
      : total > jobs.length
        ? `showing ${jobs.length} of ${total} fresh roles`
        : `${jobCards.length} fresh role${jobCards.length === 1 ? "" : "s"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#job-results"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
      >
        Skip to results
      </a>
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">heimdall</h1>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              fresh tech jobs, direct from source
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <section aria-label="Search and filters" className="mb-6">
          <div className="relative mb-3">
            <input
              ref={searchRef}
              type="text"
              placeholder="search jobs, companies, skills..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:pr-16 sm:text-base"
              aria-label="Search jobs"
            />
            <kbd className="pointer-events-none absolute top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:right-3 sm:block">
              /
            </kbd>
          </div>

          <div className="grid grid-cols-2 items-center gap-2 sm:flex">
            <FilterSelect
              value={company}
              onChange={setCompany}
              options={(filterOptions?.companies ?? []).map((o) => o.value)}
              placeholder="company"
              aria-label="Filter by company"
              className="sm:flex-1"
            />
            <FilterSelect
              value={department}
              onChange={setDepartment}
              options={(filterOptions?.departments ?? []).map((o) => o.value)}
              placeholder="role"
              aria-label="Filter by role"
              className="sm:flex-1"
            />
            <FilterSelect
              value={location}
              onChange={setLocation}
              options={locationOptions}
              placeholder="location"
              aria-label="Filter by location"
              className="sm:flex-1"
            />
            <FilterSelect
              value={posted === "week" ? "this week" : posted}
              onChange={(v) => setPosted(v === "this week" ? "week" : v)}
              options={["today", "this week"]}
              placeholder="posted"
              aria-label="Filter by posting date"
              className="sm:flex-1"
            />
          </div>
        </section>

        <ActiveFilterChips chips={chips} onClearAll={clearAllFilters} />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
          <p
            className="flex flex-wrap items-baseline gap-x-3 text-xs text-foreground"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>{countLabel}</span>
            {syncedAt ? (
              <span
                className={
                  syncStale ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                }
              >
                synced {timeAgo(syncedAt)}
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-1">
            <MoreFiltersPopover
              advancedCount={advancedCount}
              filterOptions={filterOptions}
              experience={experience}
              onExperienceChange={setExperience}
              source={source}
              onSourceChange={setSource}
              employmentType={employmentType}
              onEmploymentTypeChange={setEmploymentType}
              onClearAll={clearAllFilters}
            />
            <SortMenu sort={sort} onSortChange={setSort} />{" "}
          </div>
        </div>

        {!(isLoading || isError) && jobCards.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">no roles match these filters</p>
            {chips.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="mt-4"
              >
                clear all filters
              </Button>
            )}
          </div>
        )}

        {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor target for the skip link */}
        <ul id="job-results" className="flex flex-col gap-2">
          {Boolean(isLoading) && SKELETON_KEYS.map((key) => <JobCardSkeleton key={key} />)}
          {!isLoading &&
            jobCards.map(({ job, openings }) => (
              <JobCard key={job.id} job={job} openings={openings} />
            ))}
        </ul>

        <div ref={sentinelRef} aria-hidden="true" className="h-1" />

        {isFetchingNextPage === true && (
          <ul className="mt-2 flex flex-col gap-2">
            {SKELETON_KEYS.slice(0, SKELETON_PRELOAD_COUNT).map((key) => (
              <JobCardSkeleton key={key} />
            ))}
          </ul>
        )}

        {!hasNextPage && jobCards.length > 0 && !isLoading && !isError && (
          <p className="mt-6 text-center text-xs text-muted-foreground" role="status">
            you've reached the end — {jobCards.length} role{jobCards.length === 1 ? "" : "s"} shown
          </p>
        )}
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
