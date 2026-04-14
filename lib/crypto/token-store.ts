import crypto from "crypto";
import {
  findFileByName,
  createFile,
  updateFile,
  getFileContent,
} from "@/lib/drive/drive-service";
import { getRootFolder } from "@/lib/drive/drive-path-resolver";

const CONFIG_FILE = ".kb-config";

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? "fallback-secret-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(data: string): string {
  const key = getKey();
  const buf = Buffer.from(data, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

interface KBConfig {
  githubToken?: string;
  githubLogin?: string;
  githubName?: string;
}

async function readConfig(accessToken: string): Promise<KBConfig> {
  try {
    const root = await getRootFolder(accessToken);
    const file = await findFileByName(accessToken, CONFIG_FILE, root.id);
    if (!file) return {};
    const raw = await getFileContent(accessToken, file.id);
    return JSON.parse(decrypt(raw)) as KBConfig;
  } catch {
    return {};
  }
}

async function writeConfig(accessToken: string, config: KBConfig): Promise<void> {
  const root = await getRootFolder(accessToken);
  const encrypted = encrypt(JSON.stringify(config));
  const existing = await findFileByName(accessToken, CONFIG_FILE, root.id);
  if (existing) {
    await updateFile(accessToken, existing.id, encrypted);
  } else {
    await createFile(accessToken, CONFIG_FILE, encrypted, root.id);
  }
}

export async function storeGitHubToken(
  accessToken: string,
  githubToken: string,
  login: string,
  name: string
): Promise<void> {
  const existing = await readConfig(accessToken);
  await writeConfig(accessToken, { ...existing, githubToken, githubLogin: login, githubName: name });
}

export async function loadGitHubToken(
  accessToken: string
): Promise<{ token: string; login: string; name: string } | null> {
  const config = await readConfig(accessToken);
  if (!config.githubToken) return null;
  return { token: config.githubToken, login: config.githubLogin ?? "", name: config.githubName ?? "" };
}

export async function deleteGitHubToken(accessToken: string): Promise<void> {
  const existing = await readConfig(accessToken);
  const { githubToken: _, githubLogin: __, githubName: ___, ...rest } = existing;
  await writeConfig(accessToken, rest);
}
