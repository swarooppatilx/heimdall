const BOARD = "gitlab";

// -- Domain --

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  department: string;
  url: string;
  postedAt: Date;
  source: string;
}

// -- Greenhouse provider --

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  updated_at: string;
  absolute_url: string;
  departments: { name: string }[];
}

function mapGreenhouseJob(raw: GreenhouseJob, board: string): Job {
  return {
    id: `gh-${board}-${raw.id}`,
    title: raw.title,
    company: board,
    location: raw.location.name,
    department: raw.departments?.[0]?.name ?? "General",
    url: raw.absolute_url,
    postedAt: new Date(raw.updated_at),
    source: "greenhouse",
  };
}

async function fetchGreenhouseJobs(board: string): Promise<Job[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch jobs from ${board}: ${res.status}`);
  }

  const data = await res.json();
  return data.jobs.map((j: GreenhouseJob) => mapGreenhouseJob(j, board));
}

// -- Display --

function formatJob(job: Job): string {
  const posted = job.postedAt.toISOString().slice(0, 10);
  return `[${job.department}] ${job.title} — ${job.location} (posted ${posted})`;
}

async function main() {
  console.log(`Fetching jobs from ${BOARD}...`);

  const jobs = await fetchGreenhouseJobs(BOARD);
  console.log(`Found ${jobs.length} jobs\n`);

  for (const job of jobs.slice(0, 10)) {
    console.log(formatJob(job));
  }
}

main().catch(console.error);
