import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JobCard } from "@/components/jobs/job-card";
import { JsonLd } from "@/components/json-ld";
import { getCompanyStats, getJobsByCompany } from "@/lib/db";
import { dedupeJobs } from "@/lib/job";

const companyStats = cache(getCompanyStats);

function decodeCompany(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const company = decodeCompany(name);
  if (!company) notFound();
  const stats = await companyStats(company);
  return {
    title: `${company} — ${stats.total} open position${stats.total === 1 ? "" : "s"}`,
    alternates: {
      canonical: `/company/${company}`,
    },
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

function StatCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="rounded bg-card px-2 py-0.5 text-xs text-muted-foreground">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function CompanyPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const company = decodeCompany(name);
  if (!company) notFound();
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
      <header className="sticky top-0 z-10 border-b border-border/40 bg-background/5 backdrop-blur-3xl">
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
          <StatCard title="Departments" items={stats.departments} />
          <StatCard title="Locations" items={stats.locations} />
          <StatCard title="Sources" items={stats.sources} />
        </div>

        {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor target for the skip link */}
        <ul id="job-results" className="flex flex-col gap-2">
          {dedupeJobs(jobs, (job) => job.title.toLowerCase()).map(({ key, job, openings }) => (
            <JobCard key={key} job={job} openings={openings} />
          ))}
        </ul>
      </main>
    </div>
  );
}
