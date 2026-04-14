import { google } from "googleapis";
import { DriveFile } from "@/types";

function getDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

export async function getFolderById(
  accessToken: string,
  folderId: string
): Promise<DriveFile> {
  const drive = getDriveClient(accessToken);
  const response = await drive.files.get({
    fileId: folderId,
    fields: "id, name, mimeType, parents, webViewLink",
  });
  return response.data as DriveFile;
}

export async function listFiles(
  accessToken: string,
  parentId: string
): Promise<DriveFile[]> {
  const drive = getDriveClient(accessToken);
  const response = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, parents, webViewLink, modifiedTime)",
    pageSize: 200,
  });
  return (response.data.files ?? []) as DriveFile[];
}

export async function findFileByName(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<DriveFile | null> {
  const drive = getDriveClient(accessToken);
  const parentQuery = parentId ? ` and '${parentId}' in parents` : "";
  const response = await drive.files.list({
    q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false${parentQuery}`,
    fields: "files(id, name, mimeType, parents, webViewLink, modifiedTime)",
    pageSize: 10,
  });
  const files = response.data.files ?? [];
  if (files.length === 0) return null;
  return files[0] as DriveFile;
}

export async function findFilesByName(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<DriveFile[]> {
  const drive = getDriveClient(accessToken);
  const parentQuery = parentId ? ` and '${parentId}' in parents` : "";
  const response = await drive.files.list({
    q: `name = '${name.replace(/'/g, "\\'")}' and trashed = false${parentQuery}`,
    fields: "files(id, name, mimeType, parents, webViewLink, modifiedTime)",
    pageSize: 20,
  });
  return (response.data.files ?? []) as DriveFile[];
}

export async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const drive = getDriveClient(accessToken);
  const metadata: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  const response = await drive.files.create({
    requestBody: metadata,
    fields: "id, name, mimeType, parents, webViewLink",
  });
  return response.data as DriveFile;
}

export async function createFile(
  accessToken: string,
  name: string,
  content: string,
  parentId?: string
): Promise<DriveFile> {
  const drive = getDriveClient(accessToken);
  const metadata: {
    name: string;
    mimeType: string;
    parents?: string[];
  } = {
    name,
    mimeType: "text/plain",
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  const response = await drive.files.create({
    requestBody: metadata,
    media: {
      mimeType: "text/plain",
      body: content,
    },
    fields: "id, name, mimeType, parents, webViewLink",
  });
  return response.data as DriveFile;
}

export async function updateFile(
  accessToken: string,
  fileId: string,
  content: string
): Promise<DriveFile> {
  const drive = getDriveClient(accessToken);
  const response = await drive.files.update({
    fileId,
    media: {
      mimeType: "text/plain",
      body: content,
    },
    fields: "id, name, mimeType, parents, webViewLink",
  });
  return response.data as DriveFile;
}

export async function getFileContent(
  accessToken: string,
  fileId: string
): Promise<string> {
  const drive = getDriveClient(accessToken);
  const response = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "text" }
  );
  return response.data as string;
}

export async function appendToFile(
  accessToken: string,
  fileId: string,
  appendContent: string
): Promise<DriveFile> {
  const existingContent = await getFileContent(accessToken, fileId);
  const newContent = existingContent + "\n" + appendContent;
  return updateFile(accessToken, fileId, newContent);
}
