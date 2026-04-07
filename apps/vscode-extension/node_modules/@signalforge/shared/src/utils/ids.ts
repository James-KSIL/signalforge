export function simpleId(prefix = ''): string {
  // small stable id for prototyping
  const r = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${r}` : r;
}
