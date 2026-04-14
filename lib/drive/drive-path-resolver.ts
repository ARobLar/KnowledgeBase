import {
  findFileByName,
  createFolder,
  listFiles,
} from "./drive-service";
import { DriveFile } from "@/types";

const KB_ROOT = process.env.KB_ROOT_FOLDER ?? "KnowledgeBase";

const DEFAULT_SUBFOLDERS = [
  "recipes",
  "identity",
  "ideas",
  "projects",
  "research",
  "personal",
  "business",
  "content",
  "health-protocols",
];

export async function getRootFolder(accessToken: string): Promise<DriveFile> {
  const existing = await findFileByName(accessToken, KB_ROOT);
  if (existing) return existing;

  // Create root folder
  const root = await createFolder(accessToken, KB_ROOT);

  // Create default subfolders in parallel
  await Promise.all(
    DEFAULT_SUBFOLDERS.map((name) =>
      createFolder(accessToken, name, root.id)
    )
  );

  return root;
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
