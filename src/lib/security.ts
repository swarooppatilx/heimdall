export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const maxLen = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < maxLen; i += 1) {
    const l = i < left.length ? left[i] : 0;
    const r = i < right.length ? right[i] : 0;
    diff |= l === r ? 0 : 1;
  }
  return diff === 0;
}
