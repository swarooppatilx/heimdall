const BOARD = "gitlab";

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  updated_at: string;
  absolute_url: string;
  departments: { name: string }[];
}

async function fetchJobs(board: string): Promise<GreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${board}: ${res.status}`);
  }

  const data = await res.json();
  return data.jobs;
}

function formatJob(job: GreenhouseJob): string {
  const dept = job.departments?.[0]?.name ?? "General";
  return `[${dept}] ${job.title} — ${job.location.name} (posted ${job.updated_at})`;
}

async function main() {
  console.log(`Fetching jobs from ${BOARD}...`);

  const jobs = await fetchJobs(BOARD);
  console.log(`Found ${jobs.length} jobs\n`);

  for (const job of jobs.slice(0, 10)) {
    console.log(formatJob(job));
  }
}

main().catch(console.error);
