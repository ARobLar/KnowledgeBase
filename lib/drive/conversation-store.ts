import {
  findFileByName,
  createFile,
  updateFile,
  getFileContent,
} from "@/lib/drive/drive-service";
import { getRootFolder } from "@/lib/drive/drive-path-resolver";

const HISTORY_FILE = ".kb-history";
const MAX_ENTRIES = 100;

export interface ConversationEntry {
  id: string;
  title: string;
  preview: string;
  rawInput: string;
  inputType: "voice" | "text" | "god";
  timestamp: string;
  status: "pending" | "success" | "error";
  resultMessage?: string;
}

async function readHistory(accessToken: string): Promise<ConversationEntry[]> {
  try {
    const root = await getRootFolder(accessToken);
    const file = await findFileByName(accessToken, HISTORY_FILE, root.id);
    if (!file) return [];
    const raw = await getFileContent(accessToken, file.id);
    return JSON.parse(raw) as ConversationEntry[];
  } catch {
    return [];
  }
}

async function writeHistory(accessToken: string, entries: ConversationEntry[]): Promise<void> {
  const root = await getRootFolder(accessToken);
  const json = JSON.stringify(entries.slice(0, MAX_ENTRIES));
  const existing = await findFileByName(accessToken, HISTORY_FILE, root.id);
  if (existing) {
    await updateFile(accessToken, existing.id, json);
  } else {
    await createFile(accessToken, HISTORY_FILE, json, root.id);
  }
}

export function makeTitle(input: string): string {
  const clean = input.replace(/^god\s*mode\s*/i, "").trim();
  const first = clean.split(/[.!?\n]/)[0].trim();
  const base = first.length > 0 ? first : clean;
  return base.length > 64 ? base.slice(0, 61) + "…" : base;
}

export async function upsertConversation(
  accessToken: string,
  entry: ConversationEntry
): Promise<void> {
  const all = await readHistory(accessToken);
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.unshift(entry); // newest first
  }
  await writeHistory(accessToken, all);
}

export async function loadConversations(accessToken: string): Promise<ConversationEntry[]> {
  return readHistory(accessToken);
}

export async function deleteConversation(accessToken: string, id: string): Promise<void> {
  const all = await readHistory(accessToken);
  await writeHistory(accessToken, all.filter((e) => e.id !== id));
}
