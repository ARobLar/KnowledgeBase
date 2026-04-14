export type KBAction =
  | "CREATE_FOLDER"
  | "CREATE_FILE"
  | "EDIT_FILE"
  | "APPEND_FILE"
  | "READ_FILE"
  | "QUERY"
  | "GITHUB_CREATE_REPO"
  | "GITHUB_PUSH_FILE"
  | "GITHUB_CREATE_BRANCH"
  | "ASK_USER_TO_CLARIFY";

export type ContentType =
  | "recipe"
  | "identity"
  | "research"
  | "note"
  | "idea"
  | "general"
  | "unknown";

export interface KBIntent {
  intent: KBAction;
  folder: string | null;
  folderPath: string | null;
  fileName: string | null;
  title: string | null;
  targetDocument: string | null;
  contentType: ContentType;
  markdownContent: string | null;
  shouldAppend: boolean;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  reasoningSummary: string;
  // GitHub fields
  githubRepo: string | null;
  githubBranch: string | null;
  githubOwner: string | null;
  githubDescription: string | null;
  githubPrivate: boolean;
  githubFilePath: string | null;
  githubCommitMessage: string | null;
}

export interface OperationResult {
  success: boolean;
  action: KBAction;
  path: string | null;
  driveFileId: string | null;
  driveUrl: string | null;
  message: string;
  error?: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  inputType: "voice" | "text";
  rawInput: string;
  transcript?: string;
  intent: KBIntent;
  result: OperationResult;
  durationMs: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  modifiedTime?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  path: string;
}

export interface ProcessRequest {
  text: string;
  inputType: "voice" | "text";
  confirmed?: boolean;
  pendingIntent?: KBIntent;
}

export interface ProcessResponse {
  intent: KBIntent;
  result?: OperationResult;
  requiresConfirmation: boolean;
  message: string;
}

export interface TranscribeResponse {
  transcript: string;
  confidence?: number;
}
