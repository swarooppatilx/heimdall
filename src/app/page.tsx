"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  experience: string;
  posted: string;
  source: string;
  department: string;
  employmentType: string;
  earlyCareer: string;
  sort: string;
}

interface JobPage {
  jobs: Job[];
  total: number;
}

function useJobFilters(filters: JobFiltersInput) {
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
      if (filters.employmentType) params.set("employment_type", filters.employmentType);
      if (filters.earlyCareer) params.set("early_career", filters.earlyCareer);
      if (filters.sort) params.set("sort", filters.sort);
      if (pageParam) params.set("offset", String(pageParam));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/jobs?${params}`);
      const jobs = (await res.json()) as Job[];
      return { jobs, total: Number(res.headers.get("X-Total-Count") ?? 0) };
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.jobs.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
  });
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
  const [employmentType, setEmploymentType] = useQueryParam("employment_type", "");
  const [earlyCareer, setEarlyCareer] = useQueryParam("early_career", "");
  const [sort, setSort] = useQueryParam("sort", "");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

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
    earlyCareer,
    sort,
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useJobFilters(filters);
  const jobs = useMemo(() => data?.pages.flatMap((p) => p.jobs) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

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

  const clearAllFilters = useCallback(() => {
    setCompany("");
    setLocation("");
    setExperience("");
    setPosted("");
    setSource("");
    setDepartment("");
    setEmploymentType("");
    setEarlyCareer("");
    commitQuery("");
    router.replace("?", { scroll: false });
  }, [
    commitQuery,
    router,
    setCompany,
    setLocation,
    setExperience,
    setPosted,
    setSource,
    setDepartment,
    setEmploymentType,
    setEarlyCareer,
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
    if (earlyCareer)
      list.push({ key: "early_career", label: "early career", onRemove: () => setEarlyCareer("") });
    return list;
  }, [
    company,
    location,
    source,
    department,
    employmentType,
    experience,
    posted,
    earlyCareer,
    setCompany,
    setLocation,
    setSource,
    setDepartment,
    setEmploymentType,
    setExperience,
    setPosted,
    setEarlyCareer,
  ]);

  const syncedAt = crawlStatus?.latest?.[0]?.createdAt;
  const syncStale = syncedAt ? Date.now() - new Date(syncedAt).getTime() > 24 * 3_600_000 : false;

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
            <h1 className="text-lg font-semibold tracking-tight">Heimdall</h1>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              fresh tech jobs, direct from source
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <section aria-label="Search and filters" className="mb-6">
          <div className="relative mb-3">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search jobs, companies, skills..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 pr-16 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40 sm:text-base"
              aria-label="Search jobs"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              /
            </kbd>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              options={["remote", ...(filterOptions?.locations ?? [])]}
              placeholder="location"
              aria-label="Filter by location"
            />
            <FilterSelect
              value={department}
              onChange={setDepartment}
              options={filterOptions?.departments ?? []}
              placeholder="role"
              aria-label="Filter by role"
            />
            <FilterSelect
              value={experience}
              onChange={setExperience}
              options={["intern", "entry", "mid", "senior", "staff"]}
              placeholder="seniority"
              aria-label="Filter by seniority"
            />
            <FilterSelect
              value={posted === "week" ? "this week" : posted}
              onChange={(v) => setPosted(v === "this week" ? "week" : v)}
              options={["today", "this week"]}
              placeholder="posted"
              aria-label="Filter by posting date"
            />

            <button
              type="button"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              aria-expanded={showMoreFilters}
              className="min-h-9 rounded-md border border-dashed border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showMoreFilters ? "less −" : "more +"}
            </button>
          </div>

          {showMoreFilters && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <FilterSelect
                value={source}
                onChange={setSource}
                options={filterOptions?.sources ?? []}
                placeholder="source"
                aria-label="Filter by source"
              />
              <FilterSelect
                value={employmentType}
                onChange={setEmploymentType}
                options={filterOptions?.employmentTypes ?? []}
                placeholder="employment"
                aria-label="Filter by employment type"
              />
              <button
                type="button"
                onClick={() => setEarlyCareer(earlyCareer ? "" : "true")}
                aria-pressed={earlyCareer === "true"}
                className={`min-h-9 rounded-full px-3 text-xs transition-colors ${
                  earlyCareer
                    ? "bg-accent text-accent-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                early career
              </button>
            </div>
          )}
        </section>

        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ring/30 bg-ring/10 px-3 text-xs text-ring transition-colors hover:border-ring/60"
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

        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
          <p
            className="flex flex-wrap items-baseline gap-x-3 text-xs text-foreground"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span>{countLabel}</span>
            {syncedAt && (
              <span className={syncStale ? "text-amber-400" : "text-muted-foreground"}>
                synced {timeAgo(syncedAt)}
              </span>
            )}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Sort jobs"
              >
                Sort: {sort === "company" ? "Company A–Z" : "Newest"}
                <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuRadioGroup
                value={sort || "newest"}
                onValueChange={(v) => setSort(v === "newest" ? "" : v)}
              >
                <DropdownMenuRadioItem value="newest">Newest first</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="company">Company A–Z</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

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
