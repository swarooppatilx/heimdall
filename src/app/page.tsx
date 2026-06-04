import type { Job } from "@/lib/job";

async function getJobs(): Promise<Job[]> {
  const res = await fetch("http://localhost:3000/api/jobs", {
    cache: "no-store",
  });

  if (!res.ok) return [];
  return res.json();
}

function daysAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default async function Home() {
  const jobs = await getJobs();

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Heimdall</h1>
        <p className="text-sm text-zinc-500">fresh tech jobs, direct from source</p>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <p className="mb-6 text-sm text-zinc-500">{jobs.length} fresh jobs</p>

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
                  <h2 className="font-medium text-zinc-100 group-hover:text-white">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {job.company} · {job.location}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-zinc-600">
                  {daysAgo(job.postedAt)}
                </span>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
