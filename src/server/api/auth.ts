const encoder = new TextEncoder();

export function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const maxLen = Math.max(left.length, right.length);
  let diff = 0;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (left[i % left.length] ?? 0) ^ (right[i % right.length] ?? 0);
  }
  return diff === 0 && left.length === right.length;
}

type TokenKey = "CRAWL_TRIGGER_TOKEN";

interface TokenOptions {
  env: Partial<Record<TokenKey, string>>;
  envKey: TokenKey;
  headerKey: string;
}

export function requireToken({ env, envKey, headerKey }: TokenOptions, request: Request): boolean {
  const expected = env[envKey];
  if (!expected) return false;
  const provided = request.headers.get(headerKey);
  if (!provided) return false;
  return constantTimeEqual(expected, provided);
}
