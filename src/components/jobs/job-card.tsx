import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/job";
import { isRemoteLocation } from "@/lib/location";
import { timeAgo } from "@/lib/time-ago";

interface JobCardProps {
  job: Job;
  openings: number;
}

export function JobCard({ job, openings }: JobCardProps) {
  return (
    <li className="group rounded-lg border border-border/60 p-4 transition-colors hover:border-ring/40 hover:bg-card/60 hover:shadow-md sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h2 className="break-words text-sm font-semibold text-foreground sm:text-base">
            {job.title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            <Link
              href={`/company/${encodeURIComponent(job.company)}`}
              className="hover:text-foreground"
            >
              {job.company}
            </Link>
            {openings > 1 && (
              <Link
                href={`/?company=${encodeURIComponent(job.company)}&q=${encodeURIComponent(job.title)}`}
                className="ml-1 text-ring transition-colors hover:text-foreground"
                aria-label={`${openings} openings for ${job.title}`}
              >
                · {openings} openings
              </Link>
            )}
            <span className="text-muted-foreground"> · </span>
            {job.location}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {isRemoteLocation(job.location) && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                remote
              </span>
            )}
            <span>
              {[
                job.source,
                job.experienceLevel === "mid" ? null : job.experienceLevel,
                job.employmentType,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {Boolean(job.salary) && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-foreground">
                {job.salary}
              </span>
            )}
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
            aria-label={`Apply to ${job.title} at ${job.company}`}
          >
            apply
          </a>
        </Button>
      </div>
    </li>
  );
}
