import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import type { Session } from "next-auth";
import {
  getRootFolder,
  getOrCreateSubfolder,
} from "@/lib/drive/drive-path-resolver";
import {
  createFile,
  updateFile,
  appendToFile,
  findFileByName,
  listFiles,
  getFileContent,
  createFolder,
} from "@/lib/drive/drive-service";
import {
  createRepo,
  createBranch,
  pushFile,
  getAuthenticatedUser,
} from "@/lib/github/github-service";

type SessionWithToken = Session & { accessToken?: string };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const GOD_SYSTEM = `You are a powerful AI agent with full access to the user's Google Drive knowledge base and GitHub account.

You operate in "God Mode" — the user has granted you broad authority to take actions on their behalf.

## Your capabilities
- Google Drive: create folders, create/edit/append/read files in the KnowledgeBase
- GitHub: create repos, push files, create branches
- Conversation: ask the user questions when you need input
- Parallel work: when waiting for user input, continue with any tasks that don't depend on that input

## Rules
- NEVER delete files or repos without explicit user confirmation
- If an action is irreversible or destructive, ask first
- You can and should take multiple actions in a single response
- If you need user input for one task, proceed with other independent tasks while waiting
- Be concise in your communication — the user can hear your responses via TTS

## Response format
Return a JSON object with this structure:
{
  "message": "What you say to the user (conversational, TTS-friendly)",
  "actions": [  // list of actions to execute in order
    {
      "type": "CREATE_FILE" | "EDIT_FILE" | "APPEND_FILE" | "CREATE_FOLDER" | "READ_FILE" | "GITHUB_CREATE_REPO" | "GITHUB_PUSH_FILE" | "GITHUB_CREATE_BRANCH",
      "params": { ... action-specific params ... }
    }
  ],
  "waitingForUser": boolean,  // true if you asked a question and need their reply
  "question": string | null   // the question you asked, if any
}

## Action params
- CREATE_FILE: { folder, fileName, content }
- EDIT_FILE: { folder, fileName, content }
- APPEND_FILE: { folder, fileName, content }
- CREATE_FOLDER: { folderName }
- READ_FILE: { folder, fileName }
- GITHUB_CREATE_REPO: { name, description, private }
- GITHUB_PUSH_FILE: { owner, repo, path, content, branch, commitMessage }
- GITHUB_CREATE_BRANCH: { owner, repo, branchName, fromBranch }`;

interface GodAction {
  type: string;
  params: Record<string, unknown>;
}

interface GodResponse {
  message: string;
  actions: GodAction[];
  waitingForUser: boolean;
  question: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function executeGodAction(
  action: GodAction,
  accessToken: string,
  githubToken: string | undefined
): Promise<string> {
  const p = action.params;

  try {
    switch (action.type) {
      case "CREATE_FOLDER": {
        const root = await getRootFolder(accessToken);
        const folder = await createFolder(accessToken, p.folderName as string, root.id);
        return `Created folder "${p.folderName}" (${folder.id})`;
      }
      case "CREATE_FILE": {
        const root = await getRootFolder(accessToken);
        let parentId = root.id;
        if (p.folder) {
          const f = await getOrCreateSubfolder(accessToken, root.id, p.folder as string);
          parentId = f.id;
        }
        const file = await createFile(accessToken, p.fileName as string, p.content as string, parentId);
        return `Created file "${p.fileName}" → ${file.webViewLink}`;
      }
      case "EDIT_FILE": {
        const root = await getRootFolder(accessToken);
        let parentId = root.id;
        if (p.folder) {
          const f = await findFileByName(accessToken, p.folder as string, root.id);
          if (f) parentId = f.id;
        }
        const existing = await findFileByName(accessToken, p.fileName as string, parentId);
        if (!existing) return `File "${p.fileName}" not found — skipped`;
        await updateFile(accessToken, existing.id, p.content as string);
        return `Updated "${p.fileName}"`;
      }
      case "APPEND_FILE": {
        const root = await getRootFolder(accessToken);
        let parentId = root.id;
        if (p.folder) {
          const f = await findFileByName(accessToken, p.folder as string, root.id);
          if (f) parentId = f.id;
        }
        const existing = await findFileByName(accessToken, p.fileName as string, parentId);
        if (!existing) {
          const file = await createFile(accessToken, p.fileName as string, p.content as string, parentId);
          return `Created "${p.fileName}" (didn't exist) → ${file.webViewLink}`;
        }
        await appendToFile(accessToken, existing.id, p.content as string);
        return `Appended to "${p.fileName}"`;
      }
      case "READ_FILE": {
        const root = await getRootFolder(accessToken);
        let parentId = root.id;
        if (p.folder) {
          const f = await findFileByName(accessToken, p.folder as string, root.id);
          if (f) parentId = f.id;
        }
        const file = await findFileByName(accessToken, p.fileName as string, parentId);
        if (!file) return `File "${p.fileName}" not found`;
        const content = await getFileContent(accessToken, file.id);
        return `Contents of "${p.fileName}":\n${content.slice(0, 2000)}`;
      }
      case "GITHUB_CREATE_REPO": {
        if (!githubToken) return "GitHub not connected — skipped";
        const repo = await createRepo(githubToken, p.name as string, (p.description as string) ?? "", (p.private as boolean) ?? true);
        return `Created GitHub repo: ${repo.html_url}`;
      }
      case "GITHUB_CREATE_BRANCH": {
        if (!githubToken) return "GitHub not connected — skipped";
        const user = await getAuthenticatedUser(githubToken);
        const owner = (p.owner as string) ?? user.login;
        await createBranch(githubToken, owner, p.repo as string, p.branchName as string, (p.fromBranch as string) ?? "main");
        return `Created branch "${p.branchName}" on ${owner}/${p.repo}`;
      }
      case "GITHUB_PUSH_FILE": {
        if (!githubToken) return "GitHub not connected — skipped";
        const user = await getAuthenticatedUser(githubToken);
        const owner = (p.owner as string) ?? user.login;
        const file = await pushFile(githubToken, owner, p.repo as string, p.path as string, p.content as string, (p.commitMessage as string) ?? "Update via KnowledgeBase", (p.branch as string) ?? "main");
        return `Pushed "${p.path}" → ${file.html_url}`;
      }
      default:
        return `Unknown action: ${action.type}`;
    }
  } catch (e) {
    return `Error in ${action.type}: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function POST(req: NextRequest) {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.user || !session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const githubToken = req.headers.get("x-github-token") ?? undefined;
  const { message, history = [] } = await req.json() as { message: string; history: ChatMessage[] };

  // Build message history for Claude
  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  // Call Claude
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: GOD_SYSTEM,
    messages,
  });

  const rawText = response.content.find((b) => b.type === "text")?.text ?? "{}";

  // Parse Claude's response
  let godResp: GodResponse;
  try {
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    godResp = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
  } catch {
    godResp = { message: rawText, actions: [], waitingForUser: false, question: null };
  }

  // Execute actions
  const actionResults: string[] = [];
  for (const action of godResp.actions ?? []) {
    const result = await executeGodAction(action, session.accessToken, githubToken);
    actionResults.push(result);
  }

  return NextResponse.json({
    message: godResp.message,
    question: godResp.question ?? null,
    waitingForUser: godResp.waitingForUser ?? false,
    actionResults,
    assistantMessage: rawText, // store in history
  });
}
