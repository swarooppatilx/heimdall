export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields }));
}

const STACK_FRAMES = 2;

export function formatError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (!(err instanceof Error && err.stack)) return message;
  const frames = err.stack
    .split("\n")
    .slice(1, 1 + STACK_FRAMES)
    .map((line) => line.trim());
  if (frames.length > 0) return `${message} — ${frames.join(" | ")}`;
  return `${message} [no stack]`;
}
