"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useEffect, useRef } from "react";
import type { Job } from "@/lib/job";
import { Button } from "@/components/ui/button";
import { isRemoteLocation } from "@/lib/location";
import { timeAgo } from "@/lib/time-ago";

interface FilterOptions {
  companies: string[];
  locations: string[];
  sources: string[];
}

interface CrawlStatusEntry {
  company: string;
  status: string;
  jobsFound: number;
  durationMs: number;
  error: string | null;
  createdAt: string;
}

function useQueryParam(key: string, initial: string): [string, (v: string) => void] {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get(key) ?? initial;

  function setValue(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (v) {
      params.set(key, v);
    } else {
      params.delete(key);
    }
    router.replace(`?${params.toString()}`);
  }

  return [value, setValue];
}

const PAGE_SIZE = 200;

interface JobFiltersInput {
  q: string;
  company: string;
  location: string;
  type: string;
  experience: string;
  posted: string;
  source: string;
}

function useJobFilters(filters: JobFiltersInput) {
  return useInfiniteQuery({
    queryKey: ["jobs", filters],
    queryFn: async ({ pageParam }): Promise<Job[]> => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.company) params.set("company", filters.company);
      if (filters.location) params.set("location", filters.location);
      if (filters.type) params.set("type", filters.type);
      if (filters.experience) params.set("experience", filters.experience);
      if (filters.posted) params.set("posted", filters.posted);
      if (filters.source) params.set("source", filters.source);
      if (pageParam) params.set("offset", String(pageParam));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/jobs?${params}`);
      return res.json();
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
}

function JobsPage() {
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useQueryParam("q", "");
  const [company, setCompany] = useQueryParam("company", "");
  const [location, setLocation] = useQueryParam("location", "");
  const [type, setType] = useQueryParam("type", "");
  const [experience, setExperience] = useQueryParam("experience", "");
  const [posted, setPosted] = useQueryParam("posted", "");
  const [source, setSource] = useQueryParam("source", "");

  const deferredQuery = useDeferredValue(query);
  const filters = { q: deferredQuery, company, location, type, experience, posted, source };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFilters(filters);
  const jobs = data?.pages.flat() ?? [];

  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ["filters"],
    queryFn: () => fetch("/api/filters").then((r) => r.json()),
  });

  const { data: crawlStatus } = useQuery<{ latest: CrawlStatusEntry[] }>({
    queryKey: ["crawlStatus"],
    queryFn: () => fetch("/api/crawl/status").then((r) => r.json()),
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

  const experienceFilters = [
    { value: "", label: "all" },
    { value: "intern", label: "intern" },
    { value: "entry", label: "entry" },
    { value: "mid", label: "mid" },
    { value: "senior", label: "senior" },
    { value: "staff", label: "staff" },
  ];

  const postedFilters = [
    { value: "", label: "any time" },
    { value: "today", label: "today" },
    { value: "week", label: "this week" },
  ];

  const activeFilters = [company, location, type, experience, posted, source].filter(Boolean);

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
            <h1 className="text-lg font-semibold tracking-tight">Heimdall</h1>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              fresh tech jobs, direct from source
            </span>
          </div>
          <div className="flex items-center gap-3">
            {crawlStatus?.latest && crawlStatus.latest.length > 0 && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                last sync {timeAgo(crawlStatus.latest[0]!.createdAt)}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4">
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              placeholder="search jobs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-2.5 pr-16 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring"
              aria-label="Search jobs"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              /
            </kbd>
          </div>
        </div>

        <fieldset className="mb-3 flex flex-wrap gap-2" aria-label="Filters">
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
            aria-label="Filter by company"
          >
            <option value="">company</option>
            {filterOptions?.companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
            aria-label="Filter by location"
          >
            <option value="">location</option>
            {filterOptions?.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
            aria-label="Filter by source"
          >
            <option value="">source</option>
            {filterOptions?.sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
          <fieldset aria-label="Filter by experience level">
            {experienceFilters.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => setExperience(e.value)}
                aria-pressed={experience === e.value}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  experience === e.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {e.label}
              </button>
            ))}
          </fieldset>
          <div className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
          <fieldset aria-label="Filter by posting date">
            {postedFilters.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPosted(p.value)}
                aria-pressed={posted === p.value}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  posted === p.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </fieldset>
        </fieldset>

        {(type || activeFilters.length > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setType(type ? "" : "remote")}
              aria-pressed={type === "remote"}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                type === "remote"
                  ? "bg-accent text-accent-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              remote
            </button>
            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCompany("");
                  setLocation("");
                  setType("");
                  setExperience("");
                  setPosted("");
                  setSource("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                clear all
              </button>
            )}
          </div>
        )}

        <p
          className="mb-4 text-xs text-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isLoading
            ? "loading..."
            : isError
              ? "something went wrong fetching jobs — try again"
              : `${jobs.length} fresh jobs`}
        </p>

        <ul id="job-results" className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="group rounded-lg border border-border/60 p-3 transition-colors hover:border-ring/40 hover:bg-card/50 sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-foreground sm:text-base">{job.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    <Link
                      href={`/company/${encodeURIComponent(job.company)}`}
                      className="hover:text-foreground"
                    >
                      {job.company}
                    </Link>
                    <span className="text-muted-foreground"> · </span>
                    {job.location}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
                    {isRemoteLocation(job.location) && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                        remote
                      </span>
                    )}
                    <span className="rounded bg-muted px-1.5 py-0.5">{job.source}</span>
                    {job.experienceLevel && job.experienceLevel !== "mid" && (
                      <span className="rounded bg-muted px-1.5 py-0.5">{job.experienceLevel}</span>
                    )}
                    <span>{timeAgo(job.postedAt)}</span>
                  </div>
                </div>
                <Button asChild size="sm">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Apply to ${job.title} at ${job.company}`}
                  >
                    apply
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              aria-busy={isFetchingNextPage}
            >
              {isFetchingNextPage ? "loading..." : "load more jobs"}
            </Button>
          </div>
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
