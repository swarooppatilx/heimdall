"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FilterSelect } from "@/components/filter-select";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/job";
import { isRemoteLocation } from "@/lib/location";
import { timeAgo } from "@/lib/time-ago";

interface FilterOptions {
  companies: string[];
  locations: string[];
  sources: string[];
  departments: string[];
  employmentTypes: string[];
  regions: string[];
}

interface CrawlStatusEntry {
  company: string;
  status: string;
  jobsFound: number;
  durationMs: number;
  createdAt: string;
}

interface QueryParamOptions {
  deferCommit?: boolean;
}

function useQueryParam(
  key: string,
  initial: string,
  opts?: QueryParamOptions,
): [string, (v: string) => void, (v: string) => void] {
  const router = useRouter();
  const [value, setValueState] = useState(initial);

  const commit = useCallback(
    (v: string) => {
      const params = new URLSearchParams(window.location.search);
      if ((params.get(key) ?? "") === v) return;
      if (v) {
        params.set(key, v);
      } else {
        params.delete(key);
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [key, router],
  );

  const setValue = useCallback(
    (v: string) => {
      setValueState(v);
      if (!opts?.deferCommit) {
        commit(v);
      }
    },
    [commit, opts?.deferCommit],
  );

  useEffect(() => {
    const syncFromUrl = () =>
      setValueState(new URLSearchParams(window.location.search).get(key) ?? initial);
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [key, initial]);

  return [value, setValue, commit];
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
  department: string;
  employmentType: string;
  earlyCareer: string;
  region: string;
  sort: string;
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
      if (filters.department) params.set("department", filters.department);
      if (filters.employmentType) params.set("employment_type", filters.employmentType);
      if (filters.earlyCareer) params.set("early_career", filters.earlyCareer);
      if (filters.region) params.set("region", filters.region);
      if (filters.sort) params.set("sort", filters.sort);
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
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery, commitQuery] = useQueryParam("q", "", { deferCommit: true });
  const [company, setCompany] = useQueryParam("company", "");
  const [location, setLocation] = useQueryParam("location", "");
  const [type, setType] = useQueryParam("type", "");
  const [experience, setExperience] = useQueryParam("experience", "");
  const [posted, setPosted] = useQueryParam("posted", "");
  const [source, setSource] = useQueryParam("source", "");
  const [department, setDepartment] = useQueryParam("department", "");
  const [employmentType, setEmploymentType] = useQueryParam("employment_type", "");
  const [earlyCareer, setEarlyCareer] = useQueryParam("early_career", "");
  const [region, setRegion] = useQueryParam("region", "");
  const [sort, setSort] = useQueryParam("sort", "");

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    commitQuery(deferredQuery);
  }, [commitQuery, deferredQuery]);

  const filters = {
    q: deferredQuery,
    company,
    location,
    type,
    experience,
    posted,
    source,
    department,
    employmentType,
    earlyCareer,
    region,
    sort,
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFilters(filters);
  const jobs = data?.pages.flat() ?? [];

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

  const clearAllFilters = useCallback(() => {
    setCompany("");
    setLocation("");
    setType("");
    setExperience("");
    setPosted("");
    setSource("");
    setDepartment("");
    setEmploymentType("");
    setEarlyCareer("");
    setRegion("");
    setSort("");
    commitQuery("");
    router.replace("?", { scroll: false });
  }, [
    commitQuery,
    router,
    setCompany,
    setLocation,
    setType,
    setExperience,
    setPosted,
    setSource,
    setDepartment,
    setEmploymentType,
    setEarlyCareer,
    setRegion,
    setSort,
  ]);

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
        key: "employment",
        label: `employment: ${employmentType}`,
        onRemove: () => setEmploymentType(""),
      });
    if (region)
      list.push({ key: "region", label: `region: ${region}`, onRemove: () => setRegion("") });
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
    if (type) list.push({ key: "type", label: "remote", onRemove: () => setType("") });
    if (earlyCareer)
      list.push({ key: "early_career", label: "early career", onRemove: () => setEarlyCareer("") });
    return list;
  }, [
    company,
    location,
    source,
    department,
    employmentType,
    region,
    experience,
    posted,
    type,
    earlyCareer,
    setCompany,
    setLocation,
    setSource,
    setDepartment,
    setEmploymentType,
    setRegion,
    setExperience,
    setPosted,
    setType,
    setEarlyCareer,
  ]);

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
        <section
          aria-label="Search and filters"
          className="mb-6 rounded-xl border border-border bg-card/40 p-3 sm:p-4"
        >
          <div className="relative mb-4">
            <input
              ref={searchRef}
              type="text"
              placeholder="search jobs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 pr-16 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Search jobs"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              /
            </kbd>
          </div>

          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <fieldset aria-label="Filter by company place and source">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                company &amp; place
              </legend>
              <div className="flex flex-wrap gap-2">
                <FilterSelect
                  value={company}
                  onChange={setCompany}
                  options={filterOptions?.companies ?? []}
                  placeholder="company"
                  aria-label="Filter by company"
                />
                <FilterSelect
                  value={location}
                  onChange={setLocation}
                  options={filterOptions?.locations ?? []}
                  placeholder="location"
                  aria-label="Filter by location"
                />
                <FilterSelect
                  value={source}
                  onChange={setSource}
                  options={filterOptions?.sources ?? []}
                  placeholder="source"
                  aria-label="Filter by source"
                />
              </div>
            </fieldset>
            <fieldset aria-label="Filter by role attributes">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                role
              </legend>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect
                  value={department}
                  onChange={setDepartment}
                  options={filterOptions?.departments ?? []}
                  placeholder="department"
                  aria-label="Filter by department"
                />
                <FilterSelect
                  value={employmentType}
                  onChange={setEmploymentType}
                  options={filterOptions?.employmentTypes ?? []}
                  placeholder="employment"
                  aria-label="Filter by employment type"
                />
                <FilterSelect
                  value={region}
                  onChange={setRegion}
                  options={filterOptions?.regions ?? []}
                  placeholder="region"
                  aria-label="Filter by region"
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="h-9 min-h-11 rounded-md border border-border bg-card px-2.5 py-0 text-xs text-foreground outline-none focus:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  aria-label="Sort jobs"
                >
                  <option value="">newest first</option>
                  <option value="company">company a–z</option>
                </select>
              </div>
            </fieldset>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
            <fieldset aria-label="Filter by seniority">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                seniority
              </legend>
              <div className="flex flex-wrap gap-2">
                {experienceFilters.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setExperience(e.value)}
                    aria-pressed={experience === e.value}
                    className={`min-h-11 rounded-md px-2.5 text-xs transition-colors ${
                      experience === e.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset aria-label="Filter by posting date">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                posted
              </legend>
              <div className="flex flex-wrap gap-2">
                {postedFilters.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPosted(p.value)}
                    aria-pressed={posted === p.value}
                    className={`min-h-11 rounded-md px-2.5 text-xs transition-colors ${
                      posted === p.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset aria-label="Filter by work mode">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                work mode
              </legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setType(type ? "" : "remote")}
                  aria-pressed={type === "remote"}
                  className={`min-h-11 rounded-full px-3 text-xs transition-colors ${
                    type === "remote"
                      ? "bg-accent text-accent-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  remote
                </button>
                <button
                  type="button"
                  onClick={() => setEarlyCareer(earlyCareer ? "" : "true")}
                  aria-pressed={earlyCareer === "true"}
                  className={`min-h-11 rounded-full px-3 text-xs transition-colors ${
                    earlyCareer
                      ? "bg-accent text-accent-foreground ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  early career
                </button>
              </div>
            </fieldset>
          </div>
        </section>

        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-secondary px-3 text-xs text-secondary-foreground transition-colors hover:border-ring/60 hover:text-foreground"
                aria-label={`Remove filter ${chip.label}`}
              >
                {chip.label}
                <span
                  aria-hidden="true"
                  className="text-muted-foreground group-hover:text-foreground"
                >
                  ✕
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="min-h-9 px-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              clear all
            </button>
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
              : `${jobCards.length} fresh roles`}
        </p>

        {!isLoading && !isError && jobCards.length === 0 && (
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

        <ul id="job-results" className="flex flex-col gap-2">
          {jobCards.map(({ job, openings }) => (
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
                    {openings > 1 && (
                      <Link
                        href={`/?company=${encodeURIComponent(job.company)}&q=${encodeURIComponent(job.title)}`}
                        className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground hover:text-foreground"
                        aria-label={`${openings} openings for ${job.title}`}
                      >
                        · {openings} openings
                      </Link>
                    )}
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
                    {job.employmentType && (
                      <span className="rounded bg-muted px-1.5 py-0.5">{job.employmentType}</span>
                    )}
                    {job.salary && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-foreground">
                        {job.salary}
                      </span>
                    )}
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
