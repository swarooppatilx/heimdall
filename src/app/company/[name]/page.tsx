import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
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
    description: `browse ${stats.total} fresh tech job openings at ${company}. direct from the company career page.`,
    openGraph: {
      title: `${company} — fresh tech jobs`,
      description: `${stats.total} open positions at ${company}.`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${company} — fresh tech jobs`,
      description: `${stats.total} open positions at ${company}.`,
    },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const company = decodeURIComponent(name);
  const jobs = await getJobsByCompany(company);
  const stats = await companyStats(company);

  if (jobs.length === 0 || stats.total === 0) {
    notFound();
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
      >
        Skip to results
      </a>
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← all jobs
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{company}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.total} open position{stats.total === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Departments
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {stats.departments.map((d) => (
                <span key={d} className="rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Locations
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {stats.locations.map((l) => (
                <span key={l} className="rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sources
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {stats.sources.map((s) => (
                <span key={s} className="rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
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
              className="group rounded-lg border border-border/60 p-4 transition-colors hover:border-ring/40 hover:bg-card/60 hover:shadow-md sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-foreground sm:text-base">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{job.location}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {isRemoteLocation(job.location) && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                        remote
                      </span>
                    )}
                    <span>
                      {[job.department, job.experienceLevel === "mid" ? null : job.experienceLevel]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span>{timeAgo(job.postedAt)}</span>
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="hover:bg-primary hover:text-primary-foreground"
                >
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Apply to ${job.title}`}
                  >
                    apply
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
