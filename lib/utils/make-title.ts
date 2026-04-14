export function makeTitle(input: string): string {
  const clean = input.replace(/^god\s*mode\s*/i, "").trim();
  const first = clean.split(/[.!?\n]/)[0].trim();
  const base = first.length > 0 ? first : clean;
  return base.length > 64 ? base.slice(0, 61) + "…" : base;
}
