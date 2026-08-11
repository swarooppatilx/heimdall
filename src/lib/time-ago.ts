const MS_PER_MINUTE = 60_000;

export function timeAgo(date: Date | string): string {
  const ms = Math.max(Date.now() - new Date(date).getTime(), 0);
  const mins = Math.floor(ms / MS_PER_MINUTE);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
