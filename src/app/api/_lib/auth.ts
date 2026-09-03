import { constantTimeEqual } from "@/lib/security";

interface TokenOptions {
  env: unknown;
  envKey: string;
  headerKey: string;
}

export function requireToken({ env, envKey, headerKey }: TokenOptions, request: Request): boolean {
  const expected = (env as Record<string, string>)[envKey];
  if (!expected) return false;
  const provided = request.headers.get(headerKey);
  if (!provided) return false;
  return constantTimeEqual(expected, provided);
}
