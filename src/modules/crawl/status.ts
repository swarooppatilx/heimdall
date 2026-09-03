export interface CrawlStatusEntry {
  company: string;
  status: "ok" | "error";
  jobsFound: number;
  durationMs: number;
  error: string | null;
  createdAt: string;
}
