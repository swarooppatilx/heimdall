"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/job";

interface FilterOptions {
  companies: string[];
  locations: string[];
  sources: string[];
}

function daysAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
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
    if (source) params.set("source", source);

    setLoading(true);
    fetch(`/api/jobs?${params}`)
      .then((r) => r.json())
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [query, company, location, type, experience, source]);

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

  const typeFilters = [
    { value: "", label: "all" },
    { value: "remote", label: "remote" },
  ];

  const experienceFilters = [
    { value: "", label: "all levels" },
    { value: "intern", label: "intern" },
    { value: "entry", label: "entry" },
    { value: "mid", label: "mid" },
    { value: "senior", label: "senior" },
    { value: "staff", label: "staff" },
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Heimdall</h1>
            <p className="text-sm text-zinc-500">fresh tech jobs, direct from source</p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
          >
            {syncing ? "syncing..." : "sync"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input
            ref={searchRef}
            type="text"
            placeholder="search jobs... (/ to focus)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600"
          />
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          >
            <option value="">all companies</option>
            {filters.companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          >
            <option value="">all locations</option>
            {filters.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-600"
          >
            <option value="">all sources</option>
            {filters.sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 flex gap-2">
          {typeFilters.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                type === t.value
                  ? "bg-zinc-100 text-black"
                  : "border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-6 flex gap-2">
          {experienceFilters.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setExperience(e.value)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                experience === e.value
                  ? "bg-zinc-100 text-black"
                  : "border border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-zinc-500">
          {loading ? "loading..." : `${jobs.length} fresh jobs`}
        </p>

        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-zinc-100">{job.title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {job.company} · {job.location}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
                    <span className="rounded bg-zinc-900 px-2 py-0.5">{job.source}</span>
                    {job.experienceLevel && (
                      <span className="rounded bg-zinc-900 px-2 py-0.5">{job.experienceLevel}</span>
                    )}
                    <span>{daysAgo(job.postedAt)}</span>
                  </div>
                </div>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-300"
                >
                  apply
                </a>
              </div>
            </div>
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
