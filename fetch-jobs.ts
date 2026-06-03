import { readFileSync } from "node:fs";

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

// -- Registry --

interface RegistryEntry {
  name: string;
  provider: string;
  board: string;
}

function loadRegistry(): RegistryEntry[] {
  const raw = readFileSync("companies.json", "utf-8");
  return JSON.parse(raw).companies;
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

// -- Fetcher --

async function fetchJobs(entry: RegistryEntry): Promise<Job[]> {
  if (entry.provider === "greenhouse") {
    return fetchGreenhouseJobs(entry.board);
  }
  throw new Error(`Unknown provider: ${entry.provider}`);
}

// -- Display --

function formatJob(job: Job): string {
  const posted = job.postedAt.toISOString().slice(0, 10);
  return `[${job.company}] ${job.title} — ${job.location} (posted ${posted})`;
}

async function main() {
  const registry = loadRegistry();
  console.log(`Tracking ${registry.length} companies\n`);

  for (const entry of registry) {
    try {
      const jobs = await fetchJobs(entry);
      console.log(`${entry.name}: ${jobs.length} jobs`);
      for (const job of jobs.slice(0, 5)) {
        console.log(`  ${formatJob(job)}`);
      }
      console.log();
    } catch (err) {
      console.error(`${entry.name}: failed — ${err}`);
    }
  }
}

main().catch(console.error);
