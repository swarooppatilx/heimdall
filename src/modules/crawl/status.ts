export interface CrawlStatusEntry {
  company: string;
  status: string;
  jobsFound: number;
  durationMs: number;
  error: string | null;
  createdAt: string;
}
