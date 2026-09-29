import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JobCard } from "@/components/jobs/job-card";
import { JsonLd } from "@/components/json-ld";
import { Header } from "@/components/layout/header";
import { SkipLink } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { toCompanySlug } from "@/lib/company-slug";
import { dedupeJobs, dedupeKey, type Job } from "@/lib/job";
import { getJobsByCompany } from "@/server/jobs/queries";
import { companyFromSlug } from "@/server/jobs/sanitize";
import { formatError, logError } from "@/server/logger";

function decodeCompany(raw: string): string | null {
  const company = companyFromSlug(raw);
  return company ? company : null;
}

// One card per role, however many openings it has; counts follow the cards.
function roleCards(jobs: Job[]) {
  return dedupeJobs(jobs, dedupeKey);
}

const loadCompanyJobs = cache(async (company: string): Promise<Job[]> => {
  try {
    return await getJobsByCompany(company);
  } catch (err) {
    logError("company_page_load_failed", { company, error: formatError(err) });
    throw err;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const company = decodeCompany(name);
  if (!company) notFound();
  const total = roleCards(await loadCompanyJobs(company)).length;
  return {
    title: `${company}: ${total} fresh job${total === 1 ? "" : "s"}`,
    alternates: {
      canonical: `/company/${toCompanySlug(company)}`,
    },
    description: `browse ${total} fresh tech job openings at ${company}. direct from the company career page.`,
    openGraph: {
      title: `${company} — fresh tech jobs`,
      description: `${total} fresh jobs at ${company}.`,
      type: "website",
      siteName: "heimdall",
      url: `/company/${toCompanySlug(company)}`,
      images: ["/opengraph-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${company} — fresh tech jobs`,
      description: `${total} fresh jobs at ${company}.`,
      images: ["/twitter-image.png"],
    },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const company = decodeCompany(name);
  if (!company) notFound();
  const jobs = await loadCompanyJobs(company);
  if (jobs.length === 0) notFound();
  const cards = roleCards(jobs);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: company,
  };
  // The roles in display order; each links to the posting on the company's own ATS.
  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${company} jobs`,
    itemListElement: cards.map(({ job }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: job.url,
      name: job.title,
    })),
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <JsonLd data={orgJsonLd} />
      <JsonLd data={listJsonLd} />
      <SkipLink href="#job-results" />
      <Header
        left={
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href="/">← all jobs</Link>
          </Button>
        }
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-8 sm:px-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{company}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cards.length} fresh job{cards.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* biome-ignore lint/correctness/useUniqueElementIds: stable anchor target for the skip link */}
        <ul id="job-results" tabIndex={-1} className="flex flex-col gap-2">
          {cards.map(({ key, job, openings }) => (
            <JobCard key={key} job={job} openings={openings} showCompany={false} />
          ))}
        </ul>
      </main>
    </div>
  );
}
