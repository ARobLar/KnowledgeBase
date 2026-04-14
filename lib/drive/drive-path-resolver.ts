import {
  findFileByName,
  createFolder,
  listFiles,
  getFolderById,
} from "./drive-service";
import { DriveFile } from "@/types";

const KB_ROOT_FOLDER_ID = process.env.KB_DRIVE_FOLDER_ID;
const KB_ROOT_NAME = process.env.KB_ROOT_FOLDER ?? "KnowledgeBase";

export async function getRootFolder(accessToken: string): Promise<DriveFile> {
  // If a specific folder ID is configured, use it directly (no search needed)
  if (KB_ROOT_FOLDER_ID) {
    return getFolderById(accessToken, KB_ROOT_FOLDER_ID);
  }

  // Fallback: search by name, create if missing
  const existing = await findFileByName(accessToken, KB_ROOT_NAME);
  if (existing) return existing;

  return createFolder(accessToken, KB_ROOT_NAME);
}

export async function getOrCreateSubfolder(
  accessToken: string,
  rootId: string,
  folderName: string
): Promise<DriveFile> {
  const existing = await findFileByName(accessToken, folderName, rootId);
  if (existing) return existing;
  return createFolder(accessToken, folderName, rootId);
}

export async function resolveFilePath(
  accessToken: string,
  folderName: string | null,
  fileName: string | null
): Promise<{ folder: DriveFile | null; file: DriveFile | null }> {
  const root = await getRootFolder(accessToken);

  if (!folderName && !fileName) {
    return { folder: null, file: null };
  }

  let folder: DriveFile | null = null;
  if (folderName) {
    folder = await getOrCreateSubfolder(accessToken, root.id, folderName);
  }

  let file: DriveFile | null = null;
  if (fileName && folder) {
    file = await findFileByName(accessToken, fileName, folder.id);
  } else if (fileName) {
    file = await findFileByName(accessToken, fileName, root.id);
  }

  return { folder, file };
}

export async function listRootContents(
  accessToken: string
): Promise<DriveFile[]> {
  const root = await getRootFolder(accessToken);
  return listFiles(accessToken, root.id);
}
