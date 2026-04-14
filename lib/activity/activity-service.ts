import { ActivityEntry } from "@/types";

const STORAGE_KEY = "kb_activity";
const MAX_ENTRIES = 50;

export function addActivity(entry: ActivityEntry): void {
  if (typeof window === "undefined") return;
  const all = getAll();
  const updated = [entry, ...all].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage quota exceeded or unavailable
  }
}

export function getAll(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

export function getRecent(count = 10): ActivityEntry[] {
  return getAll().slice(0, count);
}

export function clearActivity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
