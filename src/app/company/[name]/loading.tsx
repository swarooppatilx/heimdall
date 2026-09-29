import { JobCardSkeleton } from "@/components/jobs/job-card-skeleton";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5", "w-5/6"];

// Streams while the company's jobs load from D1, so the page never sits blank.
export default function CompanyLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main aria-busy="true" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <ul className="flex flex-col gap-2">
          {SKELETON_WIDTHS.map((width) => (
            <JobCardSkeleton key={width} titleWidth={width} />
          ))}
        </ul>
      </main>
    </div>
  );
}
