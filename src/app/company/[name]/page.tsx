import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { JsonLd } from "@/components/json-ld";
import { getCompanyStats, getJobsByCompany } from "@/lib/db";
import { isRemoteLocation } from "@/lib/location";
import { timeAgo } from "@/lib/time-ago";

const companyStats = cache(getCompanyStats);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const company = decodeURIComponent(name);
  const stats = await companyStats(company);
  return {
    title: `${company} — ${stats.total} open position${stats.total === 1 ? "" : "s"}`,
    description: `Browse ${stats.total} fresh tech job openings at ${company}. Direct from the company career page.`,
    openGraph: {
      title: `${company} — Fresh Tech Jobs`,
      description: `${stats.total} open positions at ${company}.`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${company} — Fresh Tech Jobs`,
      description: `${stats.total} open positions at ${company}.`,
    },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const company = decodeURIComponent(name);
  const jobs = await getJobsByCompany(company);
  const stats = await companyStats(company);

  if (jobs.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-zinc-100">
        <p className="text-zinc-500">No jobs found for {company}</p>
        <Link href="/" className="mt-4 text-sm text-zinc-400 hover:text-zinc-200">
          ← back to search
        </Link>
      </div>
    );
  }

    const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company,
    url: jobs[0]?.url?.split("/jobs/")[0] || undefined,
    numberOfEmployees: stats.total,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={jsonLd} />
      <a
        href="#job-results"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-800 focus:px-4 focus:py-2 focus:text-sm focus:text-zinc-100"
      >
        Skip to results
      </a>
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← all jobs
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{company}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {stats.total} open position{stats.total === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Departments
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {stats.departments.map((d) => (
                <span key={d} className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Locations
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {stats.locations.map((l) => (
                <span key={l} className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Sources
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {stats.sources.map((s) => (
                <span key={s} className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <ul id="job-results" className="flex flex-col gap-2">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="group rounded-lg border border-zinc-800/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50 sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-medium text-zinc-100 sm:text-base">{job.title}</h2>
                  <p className="mt-0.5 text-xs text-zinc-400 sm:text-sm">{job.location}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400 sm:gap-2 sm:text-xs">
                    {isRemoteLocation(job.location) && (
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
                        remote
                      </span>
                    )}
                    <span className="rounded bg-zinc-800/50 px-1.5 py-0.5">{job.department}</span>
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
                  aria-label={`Apply to ${job.title}`}
                >
                  apply
                </a>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
