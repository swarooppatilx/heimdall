"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/job";

interface FilterOptions {
  companies: string[];
  locations: string[];
  sources: string[];
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
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

function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    companies: [],
    locations: [],
    sources: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useQueryParam("q", "");
  const [company, setCompany] = useQueryParam("company", "");
  const [location, setLocation] = useQueryParam("location", "");
  const [type, setType] = useQueryParam("type", "");
  const [experience, setExperience] = useQueryParam("experience", "");
  const [posted, setPosted] = useQueryParam("posted", "");
  const [source, setSource] = useQueryParam("source", "");

  const fetchFilters = useCallback(() => {
    fetch("/api/filters")
      .then((r) => r.json())
      .then(setFilters)
      .catch(() => {});
  }, []);

  const fetchJobs = useCallback(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (company) params.set("company", company);
    if (location) params.set("location", location);
    if (type) params.set("type", type);
    if (experience) params.set("experience", experience);
    if (posted) params.set("posted", posted);
    if (source) params.set("source", source);

    setLoading(true);
    fetch(`/api/jobs?${params}`)
      .then((r) => r.json())
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [query, company, location, type, experience, posted, source]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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

  function handleSync() {
    setSyncing(true);
    fetch("/api/sync", { method: "POST" })
      .then(() => fetchFilters())
      .then(() => fetchJobs())
      .finally(() => setSyncing(false));
  }

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
    { value: "month", label: "this month" },
  ];

  const activeFilters = [company, location, type, experience, posted, source].filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Heimdall</h1>
            <span className="hidden text-xs text-zinc-600 sm:inline">
              fresh tech jobs, direct from source
            </span>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
          >
            {syncing ? "syncing..." : "sync"}
          </button>
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
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 pr-16 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
              aria-label="Search jobs"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
              /
            </kbd>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-zinc-600"
            aria-label="Filter by company"
          >
            <option value="">company</option>
            {filters.companies.map((c) => (
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
            {filters.locations.map((l) => (
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
            {filters.sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="hidden h-6 w-px bg-zinc-800 sm:block" aria-hidden="true" />
          {experienceFilters.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setExperience(e.value)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                experience === e.value
                  ? "bg-zinc-100 text-black"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {e.label}
            </button>
          ))}
          <div className="hidden h-6 w-px bg-zinc-800 sm:block" aria-hidden="true" />
          {postedFilters.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPosted(p.value)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                posted === p.value ? "bg-zinc-100 text-black" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {(type || activeFilters.length > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setType(type ? "" : "remote")}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                type === "remote"
                  ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                  : "text-zinc-500 hover:text-zinc-300"
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
                className="text-xs text-zinc-600 hover:text-zinc-400"
              >
                clear all
              </button>
            )}
          </div>
        )}

        <p className="mb-4 text-xs text-zinc-600">
          {loading ? "loading..." : `${jobs.length} fresh jobs`}
        </p>

        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <article
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
                    <span className="text-zinc-600"> · </span>
                    {job.location}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600 sm:gap-2 sm:text-xs">
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
            </article>
          ))}
        </div>
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
