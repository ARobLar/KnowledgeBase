import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { loadGitHubToken, getActiveRepo, setActiveRepo } from "@/lib/crypto/token-store";
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
  getFileContent,
  createFolder,
  listFiles,
} from "@/lib/drive/drive-service";
import {
  createRepo,
  createBranch,
  pushFile,
  getAuthenticatedUser,
  listRepos,
} from "@/lib/github/github-service";

type SessionWithToken = Session & { accessToken?: string };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DEV_SYSTEM = `You are an elite software engineering agent operating in Dev Mode. You are simultaneously:

- **Architect**: Design systems, choose the right patterns, plan scalable structure
- **Lead Developer**: Write production-quality code in any language/framework
- **Project Manager**: Break work into clear tasks, track progress, set priorities
- **DevOps Engineer**: Set up CI/CD pipelines, Docker, GitHub Actions, deployment configs
- **QA/Tester**: Write unit tests, integration tests, end-to-end tests, set up test infrastructure
- **Security Engineer**: Identify vulnerabilities, apply security best practices
- **Code Reviewer**: Spot issues, suggest improvements, maintain code quality

## Context
The user has a GitHub account connected. You operate against a specific repository (the "active repo").
When the user says things like "create a repo", "set up a project", "build X", you take concrete action.

## Key behaviors
- When creating a new repo, always create it and signal the repo update so the UI can update
- ALWAYS write actual, working code — never placeholder or pseudocode unless asked
- When setting up a project: scaffold the full structure (README, .gitignore, source, tests, CI)
- Push code file by file to GitHub — each file as a separate push action or batched logically
- If no active repo is set, ask the user to create one or specify an existing one FIRST
- Be concise — the user can hear your responses via TTS

## Response format
Return a JSON object:
{
  "message": "What you say to the user (conversational, action-oriented)",
  "actions": [
    {
      "type": "GITHUB_CREATE_REPO" | "GITHUB_PUSH_FILE" | "GITHUB_CREATE_BRANCH" | "GITHUB_LIST_REPOS" | "CREATE_FILE" | "READ_FILE",
      "params": { ... }
    }
  ],
  "waitingForUser": boolean,
  "question": string | null,
  "repoUpdate": {           // set this when a new repo is created or active repo changes
    "fullName": "owner/repo",
    "private": boolean,
    "htmlUrl": "https://github.com/..."
  } | null
}

## Action params
- GITHUB_CREATE_REPO: { name, description, private }
- GITHUB_PUSH_FILE: { owner, repo, path, content, branch, commitMessage }
- GITHUB_CREATE_BRANCH: { owner, repo, branchName, fromBranch }
- GITHUB_LIST_REPOS: {}  (lists user's repos for selection)
- CREATE_FILE: { folder, fileName, content }  (Drive fallback, rarely needed)
- READ_FILE: { folder, fileName }  (read from Drive knowledge base)

## Style guide for pushed code
- Include a meaningful README.md in every new repo
- Add .gitignore appropriate for the tech stack
- Add GitHub Actions workflow if relevant
- Write comments only where logic is non-obvious
- Follow language-idiomatic conventions`;

interface DevAction {
  type: string;
  params: Record<string, unknown>;
}

interface DevResponse {
  message: string;
  actions: DevAction[];
  waitingForUser: boolean;
  question: string | null;
  repoUpdate: { fullName: string; private: boolean; htmlUrl: string } | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function executeDevAction(
  action: DevAction,
  accessToken: string,
  githubToken: string | undefined
): Promise<string> {
  const p = action.params;

  try {
    switch (action.type) {
      case "GITHUB_LIST_REPOS": {
        if (!githubToken) return "GitHub not connected";
        const repos = await listRepos(githubToken);
        return `Your repos: ${repos.map((r) => `${r.full_name} (${r.private ? "private" : "public"})`).join(", ")}`;
      }
      case "GITHUB_CREATE_REPO": {
        if (!githubToken) return "GitHub not connected — skipped";
        const repo = await createRepo(githubToken, p.name as string, (p.description as string) ?? "", (p.private as boolean) ?? true);
        return `Created GitHub repo: ${repo.html_url} (fullName: ${repo.full_name}, private: ${repo.private})`;
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
        const file = await pushFile(
          githubToken, owner, p.repo as string, p.path as string,
          p.content as string, (p.commitMessage as string) ?? "Add file via KnowledgeBase Dev Mode",
          (p.branch as string) ?? "main"
        );
        return `Pushed "${p.path}" → ${file.html_url}`;
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

  const cookieStore = await cookies();
  let githubToken = cookieStore.get("kb_gh_token")?.value ?? undefined;
  if (!githubToken && session.accessToken) {
    try {
      const stored = await loadGitHubToken(session.accessToken);
      if (stored) githubToken = stored.token;
    } catch { /* best-effort */ }
  }

  const { message, history = [], activeRepo } = await req.json() as {
    message: string;
    history: ChatMessage[];
    activeRepo?: { fullName: string; private: boolean; htmlUrl: string } | null;
  };

  // Build context about active repo
  const repoContext = activeRepo
    ? `\n\n## Active repository\n${activeRepo.fullName} (${activeRepo.private ? "private" : "public"}) — ${activeRepo.htmlUrl}`
    : "\n\n## Active repository\nNo active repository set. Ask the user to create one or select an existing one before doing any GitHub work.";

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: DEV_SYSTEM + repoContext,
    messages,
  });

  const rawText = response.content.find((b) => b.type === "text")?.text ?? "{}";

  let devResp: DevResponse;
  try {
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    devResp = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
  } catch {
    devResp = { message: rawText, actions: [], waitingForUser: false, question: null, repoUpdate: null };
  }

  // Execute actions
  const actionResults: string[] = [];
  for (const action of devResp.actions ?? []) {
    const result = await executeDevAction(action, session.accessToken, githubToken);
    actionResults.push(result);

    // If repo was just created, extract the info and persist it
    if (action.type === "GITHUB_CREATE_REPO" && result.includes("Created GitHub repo:")) {
      const match = result.match(/fullName: ([^,)]+), private: (\w+)/);
      const urlMatch = result.match(/https:\/\/github\.com\/[^\s)]+/);
      if (match && urlMatch && !devResp.repoUpdate) {
        devResp.repoUpdate = {
          fullName: match[1].trim(),
          private: match[2] === "true",
          htmlUrl: urlMatch[0],
        };
      }
    }
  }

  // Persist active repo update if agent signalled one
  if (devResp.repoUpdate && session.accessToken) {
    await setActiveRepo(session.accessToken, devResp.repoUpdate).catch(() => {});
  }

  return NextResponse.json({
    message: devResp.message,
    question: devResp.question ?? null,
    waitingForUser: devResp.waitingForUser ?? false,
    actionResults,
    repoUpdate: devResp.repoUpdate ?? null,
    assistantMessage: rawText,
  });
}
