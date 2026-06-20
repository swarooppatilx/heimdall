"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import type { Job } from "@/lib/job";

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

function timeAgo(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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

  const filters = { q: query, company, location, type, experience, posted, source };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
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

  const isRemote = (l: string) => l.toLowerCase().startsWith("remote");

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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-800 focus:px-4 focus:py-2 focus:text-sm focus:text-zinc-100"
      >
        Skip to results
      </a>
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Heimdall</h1>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              fresh tech jobs, direct from source
            </span>
          </div>
          <div className="flex items-center gap-3">
            {crawlStatus?.latest && crawlStatus.latest.length > 0 && (
              <span className="hidden text-[11px] text-zinc-500 sm:inline">
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
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 pr-16 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-600"
              aria-label="Search jobs"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
              /
            </kbd>
          </div>
        </div>

        <fieldset className="mb-3 flex flex-wrap gap-2" aria-label="Filters">
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
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
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
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
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
            aria-label="Filter by source"
          >
            <option value="">source</option>
            {filterOptions?.sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="hidden h-6 w-px bg-zinc-800 sm:block" aria-hidden="true" />
          <fieldset aria-label="Filter by experience level">
            {experienceFilters.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => setExperience(e.value)}
                aria-pressed={experience === e.value}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  experience === e.value
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {e.label}
              </button>
            ))}
          </fieldset>
          <div className="hidden h-6 w-px bg-zinc-800 sm:block" aria-hidden="true" />
          <fieldset aria-label="Filter by posting date">
            {postedFilters.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPosted(p.value)}
                aria-pressed={posted === p.value}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  posted === p.value
                    ? "bg-zinc-100 text-black"
                    : "text-zinc-400 hover:text-zinc-200"
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
                  ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                  : "text-zinc-400 hover:text-zinc-200"
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
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                clear all
              </button>
            )}
          </div>
        )}

        <p
          className="mb-4 text-xs text-zinc-300"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isLoading ? "loading..." : `${jobs.length} fresh jobs`}
        </p>

        <ul id="job-results" className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="group rounded-lg border border-zinc-800/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50 sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-zinc-100 sm:text-base">{job.title}</h2>
                  <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">
                    <Link
                      href={`/company/${encodeURIComponent(job.company)}`}
                      className="hover:text-zinc-200"
                    >
                      {job.company}
                    </Link>
                    <span className="text-zinc-500"> · </span>
                    {job.location}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 sm:gap-2 sm:text-xs">
                    {isRemote(job.location) && (
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
                        remote
                      </span>
                    )}
                    <span className="rounded bg-zinc-800/50 px-1.5 py-0.5">{job.source}</span>
                    {job.experienceLevel && job.experienceLevel !== "mid" && (
                      <span className="rounded bg-zinc-800/50 px-1.5 py-0.5">
                        {job.experienceLevel}
                      </span>
                    )}
                    <span>{timeAgo(job.postedAt)}</span>
                  </div>
                </div>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-zinc-300 sm:px-4 sm:py-2 sm:text-sm"
                  aria-label={`Apply to ${job.title} at ${job.company}`}
                >
                  apply
                </a>
              </div>
            </li>
          ))}
        </ul>

        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-md border border-zinc-800 px-4 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
            >
              {isFetchingNextPage ? "loading..." : "load more jobs"}
            </button>
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
