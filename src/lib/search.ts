export function buildMatchQuery(raw: string): string {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token));
  if (tokens.length === 0) return "";
  return tokens
    .map((token, index) => {
      const phrase = `"${token.replaceAll('"', '""')}"`;
      return index === tokens.length - 1 ? `${phrase}*` : phrase;
    })
    .join(" ");
}
