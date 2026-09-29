// FTS5 query strings for jobs_fts. Searches are limited to the text columns,
// because job_id is indexed only so writes can find a job's row quickly.
const SEARCH_COLUMNS = "{title company location department}";
const MIN_PREFIX_LENGTH = 2;

function phrase(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

// Prefix-match the last token so results follow typing, but only for plain
// words: FTS5 drops symbols, so "c++" would otherwise become `c*` and match
// every word starting with c.
function allowsPrefix(token: string): boolean {
  return token.length >= MIN_PREFIX_LENGTH && /^[\p{L}\p{N}]+$/u.test(token);
}

export function buildMatchQuery(raw: string): string {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token));
  if (tokens.length === 0) return "";
  const terms = tokens.map((token, index) =>
    index === tokens.length - 1 && allowsPrefix(token) ? `${phrase(token)}*` : phrase(token),
  );
  return `${SEARCH_COLUMNS} : (${terms.join(" ")})`;
}

/** Matches the search rows of the given jobs through the job_id index. */
export function jobIdMatch(ids: string[]): string {
  return ids.map((id) => `job_id : ${phrase(id)}`).join(" OR ");
}
