import Link from "next/link";
import { toCompanySlug } from "@/lib/company-slug";
import type { Job, JobDto } from "@/lib/job";
import { MS_PER_DAY, timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: Job | JobDto;
  openings: number;
  showCompany?: boolean;
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-muted-foreground">
      ·
    </span>
  );
}

export function JobCard({ job, openings, showCompany = true }: JobCardProps) {
  const postedAt = new Date(job.postedAt);
  const postedToday = Date.now() - postedAt.getTime() < MS_PER_DAY;
  const details = [job.location, job.salary, openings > 1 ? `${openings} openings` : null].filter(
    (detail): detail is string => Boolean(detail),
  );

  return (
    <li className="content-auto relative isolate rounded-lg border border-border p-3 transition-[background-color,box-shadow] hover:bg-card hover:shadow-sm active:bg-muted sm:p-4">
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        title={`via ${job.source}`}
        aria-label={`Apply to ${job.title} at ${job.company}`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="sr-only">Apply</span>
      </a>

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-sm font-semibold break-words text-foreground sm:text-base">
          {job.title}
        </h2>
        {/* relative time differs between server render and hydration by design */}
        <time
          dateTime={postedAt.toISOString()}
          className={cn(
            "shrink-0 font-mono text-xs font-medium tabular-nums",
            postedToday ? "text-foreground" : "text-muted-foreground",
          )}
          suppressHydrationWarning
        >
          {timeAgo(postedAt)}
        </time>
      </div>

      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {showCompany ? (
          <>
            <Link
              href={`/company/${toCompanySlug(job.company)}`}
              prefetch={false}
              className="relative z-10 -my-1.5 py-1.5 font-medium text-foreground/90 hover:text-foreground hover:underline"
            >
              {job.company}
            </Link>
            <Dot />
          </>
        ) : null}
        {details.map((detail, i) => (
          <span key={detail} className="contents">
            {i > 0 ? <Dot /> : null}
            <span className={detail === job.salary ? "text-foreground/80" : undefined}>
              {detail}
            </span>
          </span>
        ))}
      </p>
    </li>
  );
}
