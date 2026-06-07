"use client";

import { useEffect, useRef, useState } from "react";
import type { Job } from "@/lib/job";

function daysAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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
  }, []);

  function handleSync() {
    setSyncing(true);
    fetch("/api/sync", { method: "POST" })
      .then(() =>
        fetch(
          `/api/jobs?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(company ? { company } : {}), ...(location ? { location } : {}), ...(type ? { type } : {}) })}`,
        ),
      )
      .then((r) => r.json())
      .then(setJobs)
      .finally(() => setSyncing(false));
  }

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (company) params.set("company", company);
    if (location) params.set("location", location);
    if (type) params.set("type", type);

    setLoading(true);
    fetch(`/api/jobs?${params}`)
      .then((r) => r.json())
      .then(setJobs)
      .finally(() => setLoading(false));
  }, [query, company, location, type]);

  const companies = [...new Set(jobs.map((j) => j.company))];
  const locations = [...new Set(jobs.map((j) => j.location))];

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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
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
            {companies.map((c) => (
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
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6 flex gap-2">
          {[
            { value: "", label: "all" },
            { value: "remote", label: "remote" },
            { value: "internship", label: "internship" },
            { value: "new_grad", label: "new grad" },
            { value: "full_time", label: "full time" },
          ].map((t) => (
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

        <p className="mb-4 text-sm text-zinc-500">
          {loading ? "loading..." : `${jobs.length} fresh jobs`}
        </p>

        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <a
              key={job.id}
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium text-zinc-100 group-hover:text-white">{job.title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {job.company} · {job.location}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-600">{daysAgo(job.postedAt)}</span>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
