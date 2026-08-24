import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { JobCard } from "@/components/jobs/job-card";
import { JsonLd } from "@/components/json-ld";
import { fromCompanySlug, toCompanySlug } from "@/lib/company-slug";
import { countJobsByCompany, getJobsByCompany } from "@/lib/db";
import { dedupeJobs } from "@/lib/job";

function decodeCompany(raw: string): string | null {
  const company = fromCompanySlug(raw);
  return company ? company : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const company = decodeCompany(name);
  if (!company) notFound();
  const total = await countJobsByCompany(company);
  return {
    title: `${company} — ${total} open position${total === 1 ? "" : "s"}`,
    alternates: {
      canonical: `/company/${toCompanySlug(company)}`,
    },
    description: `browse ${total} fresh tech job openings at ${company}. direct from the company career page.`,
    openGraph: {
      title: `${company} — fresh tech jobs`,
      description: `${total} open positions at ${company}.`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${company} — fresh tech jobs`,
      description: `${total} open positions at ${company}.`,
    },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const company = decodeCompany(name);
  if (!company) notFound();
  const jobs = await getJobsByCompany(company);

  if (jobs.length === 0) {
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
      <Header
        left={
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← all jobs
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{company}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {jobs.length} open position{jobs.length === 1 ? "" : "s"}
          </p>
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
