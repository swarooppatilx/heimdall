import { ArrowUpRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type { Job } from "@/lib/job";
import { timeAgo } from "@/lib/time-ago";

interface JobCardProps {
  job: Job;
  openings: number;
}

export function JobCard({ job, openings }: JobCardProps) {
  return (
    <li className="group relative rounded-lg border border-border/60 p-3 transition-colors hover:border-ring/40 hover:bg-card/60 hover:shadow-md sm:p-4">
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`via ${job.source}`}
        aria-label={`Apply to ${job.title} at ${job.company}`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="sr-only">Apply</span>
      </a>

      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground sm:text-base">
          <span className="truncate">{job.title}</span>
          {openings > 1 && (
            <Link
              href={`/?company=${encodeURIComponent(job.company)}&q=${encodeURIComponent(job.title)}`}
              className="ml-1.5 inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 align-middle text-[10px] font-medium text-secondary-foreground hover:bg-secondary/80"
              aria-label={`${openings} openings for ${job.title}`}
            >
              ×{openings}
            </Link>
          )}
        </h2>
        <HugeiconsIcon
          icon={ArrowUpRightIcon}
          strokeWidth={2}
          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs">
        <Link
          href={`/company/${encodeURIComponent(job.company)}`}
          className="font-medium capitalize text-foreground/90 hover:text-foreground hover:underline"
        >
          {job.company}
        </Link>
        <span aria-hidden="true" className="text-muted-foreground/60">
          ·
        </span>
        <span className="truncate capitalize text-muted-foreground">{job.location}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {job.experienceLevel && job.experienceLevel !== "mid" && (
          <span className="capitalize">{job.experienceLevel}</span>
        )}
        {Boolean(job.employmentType) && <span className="capitalize">{job.employmentType}</span>}
        {Boolean(job.salary) && (
          <span className="font-medium text-foreground/80">{job.salary}</span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">{timeAgo(job.postedAt)}</span>
      </div>
    </li>
  );
}
