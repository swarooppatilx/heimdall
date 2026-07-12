export interface CrawlSample {
  company: string;
  status: string;
  jobsFound: number;
}

export interface BoardHealth {
  company: string;
  crawls: number;
  errors: number;
  consecutiveEmpty: number;
}

export function assessBoards(samples: CrawlSample[], newestFirst = true): BoardHealth[] {
  const byCompany = new Map<string, CrawlSample[]>();
  for (const sample of samples) {
    const list = byCompany.get(sample.company);
    if (list) list.push(sample);
    else byCompany.set(sample.company, [sample]);
  }

  const health: BoardHealth[] = [];
  for (const [company, records] of byCompany) {
    const ordered = newestFirst ? records : [...records].reverse();
    let consecutiveEmpty = 0;
    for (const record of ordered) {
      if (record.status !== "ok" || record.jobsFound > 0) break;
      consecutiveEmpty += 1;
    }
    health.push({
      company,
      crawls: records.length,
      errors: records.filter((r) => r.status === "error").length,
      consecutiveEmpty,
    });
  }
  return health;
}

export function driftedBoards(
  boards: BoardHealth[],
  minConsecutiveEmpty: number,
): BoardHealth[] {
  return boards.filter((b) => b.consecutiveEmpty >= minConsecutiveEmpty);
}
