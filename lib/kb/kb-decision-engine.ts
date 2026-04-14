import { KBIntent, KBAction, OperationResult } from "@/types";
import {
  getRootFolder,
  getOrCreateSubfolder,
  resolveFilePath,
} from "../drive/drive-path-resolver";
import {
  findFilesByName,
  createFolder,
  createFile,
  updateFile,
  appendToFile,
} from "../drive/drive-service";
import { formatContent } from "../markdown/markdown-service";

export interface DecisionContext {
  intent: KBIntent;
  accessToken: string;
}

export async function executeDecision(
  ctx: DecisionContext
): Promise<OperationResult> {
  const { intent, accessToken } = ctx;

  // Always clarify if needed
  if (intent.needsClarification || intent.intent === "ASK_USER_TO_CLARIFY") {
    return {
      success: false,
      action: "ASK_USER_TO_CLARIFY",
      path: null,
      driveFileId: null,
      driveUrl: null,
      message:
        intent.clarificationQuestion ??
        "Could you please provide more details?",
    };
  }

  try {
    switch (intent.intent) {
      case "CREATE_FOLDER":
        return await handleCreateFolder(intent, accessToken);
      case "CREATE_FILE":
        return await handleCreateFile(intent, accessToken);
      case "EDIT_FILE":
        return await handleEditFile(intent, accessToken);
      case "APPEND_FILE":
        return await handleAppendFile(intent, accessToken);
      default:
        return {
          success: false,
          action: intent.intent,
          path: null,
          driveFileId: null,
          driveUrl: null,
          message: "Unknown action",
          error: `Unrecognized action: ${intent.intent}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      action: intent.intent,
      path: null,
      driveFileId: null,
      driveUrl: null,
      message: "Operation failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleCreateFolder(
  intent: KBIntent,
  accessToken: string
): Promise<OperationResult> {
  const folderName = intent.folder ?? intent.title ?? "new-folder";
  const root = await getRootFolder(accessToken);

  // Check if folder already exists
  const existing = await findFilesByName(accessToken, folderName, root.id);
  if (existing.length > 0) {
    return {
      success: false,
      action: "CREATE_FOLDER",
      path: `KnowledgeBase/${folderName}`,
      driveFileId: existing[0].id,
      driveUrl: existing[0].webViewLink ?? null,
      message: `Folder "${folderName}" already exists in KnowledgeBase.`,
    };
  }

  const folder = await createFolder(accessToken, folderName, root.id);
  return {
    success: true,
    action: "CREATE_FOLDER",
    path: `KnowledgeBase/${folderName}`,
    driveFileId: folder.id,
    driveUrl: folder.webViewLink ?? null,
    message: `Created folder "${folderName}" in KnowledgeBase.`,
  };
}

async function handleCreateFile(
  intent: KBIntent,
  accessToken: string
): Promise<OperationResult> {
  const fileName = intent.fileName ?? `${slugify(intent.title ?? "note")}.md`;
  const content = formatContent(intent);
  const root = await getRootFolder(accessToken);

  let parentId = root.id;
  let path = `KnowledgeBase/${fileName}`;

  if (intent.folder) {
    const folder = await getOrCreateSubfolder(
      accessToken,
      root.id,
      intent.folder
    );
    parentId = folder.id;
    path = `KnowledgeBase/${intent.folder}/${fileName}`;
  }

  // Check for existing file with same name — if found, ask to clarify
  const existing = await findFilesByName(accessToken, fileName, parentId);
  if (existing.length > 0) {
    // File already exists — fall back to append
    const updated = await appendToFile(
      accessToken,
      existing[0].id,
      `\n---\n*Updated: ${new Date().toISOString()}*\n\n${content}`
    );
    return {
      success: true,
      action: "APPEND_FILE",
      path,
      driveFileId: updated.id,
      driveUrl: updated.webViewLink ?? null,
      message: `File "${fileName}" already existed — appended new content instead.`,
    };
  }

  const file = await createFile(accessToken, fileName, content, parentId);
  return {
    success: true,
    action: "CREATE_FILE",
    path,
    driveFileId: file.id,
    driveUrl: file.webViewLink ?? null,
    message: `Created "${fileName}" in ${path}.`,
  };
}

async function handleEditFile(
  intent: KBIntent,
  accessToken: string
): Promise<OperationResult> {
  // Safety: never destructive edit if confidence < 0.8
  if (intent.confidence < 0.8) {
    return {
      success: false,
      action: "EDIT_FILE",
      path: null,
      driveFileId: null,
      driveUrl: null,
      message: `Cannot safely edit: confidence is ${(intent.confidence * 100).toFixed(0)}% (need ≥80%). Please be more specific.`,
    };
  }

  const targetName =
    intent.targetDocument ?? intent.fileName ?? `${slugify(intent.title ?? "note")}.md`;
  const { folder, file } = await resolveFilePath(
    accessToken,
    intent.folder,
    targetName
  );

  if (!file) {
    // File doesn't exist — create it instead
    return handleCreateFile(intent, accessToken);
  }

  const content = formatContent(intent);
  const updated = await updateFile(accessToken, file.id, content);
  const path = folder
    ? `KnowledgeBase/${folder.name}/${targetName}`
    : `KnowledgeBase/${targetName}`;

  return {
    success: true,
    action: "EDIT_FILE",
    path,
    driveFileId: updated.id,
    driveUrl: updated.webViewLink ?? null,
    message: `Updated "${targetName}" at ${path}.`,
  };
}

async function handleAppendFile(
  intent: KBIntent,
  accessToken: string
): Promise<OperationResult> {
  const targetName =
    intent.targetDocument ?? intent.fileName ?? `${slugify(intent.title ?? "note")}.md`;
  const { folder, file } = await resolveFilePath(
    accessToken,
    intent.folder,
    targetName
  );

  if (!file) {
    // File doesn't exist — create it instead
    return handleCreateFile({ ...intent, intent: "CREATE_FILE" }, accessToken);
  }

  const appendContent =
    intent.markdownContent ??
    `\n*${new Date().toISOString()}*\n\n(no content provided)`;
  const updated = await appendToFile(accessToken, file.id, appendContent);
  const path = folder
    ? `KnowledgeBase/${folder.name}/${targetName}`
    : `KnowledgeBase/${targetName}`;

  return {
    success: true,
    action: "APPEND_FILE",
    path,
    driveFileId: updated.id,
    driveUrl: updated.webViewLink ?? null,
    message: `Appended to "${targetName}" at ${path}.`,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
