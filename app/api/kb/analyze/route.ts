import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { loadGitHubToken } from "@/lib/crypto/token-store";
import Anthropic from "@anthropic-ai/sdk";
import { KBS_TEMPLATE } from "@/lib/kb-schema/kbs-template";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GH = "https://api.github.com";

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<string | null> {
  try {
    const res = await fetch(`${GH}/repos/${owner}/${repo}/contents/${path}`, {
      headers: ghHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { content?: string; encoding?: string };
    if (data.content && data.encoding === "base64") {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

// Build a concise directory tree (directories only, depth ≤ 3)
function buildDirTree(paths: string[]): string {
  const dirs = new Set<string>();
  for (const p of paths) {
    const parts = p.split("/");
    for (let d = 1; d <= Math.min(parts.length, 3); d++) {
      dirs.add(parts.slice(0, d).join("/"));
    }
  }
  return Array.from(dirs).sort().join("\n");
}

// Ordered list of files to try fetching (most valuable first)
const PRIORITY_FILES = [
  "README.md", "readme.md", "README.mdx",
  "CLAUDE.md", ".cursorrules", ".github/copilot-instructions.md",
  "package.json", "requirements.txt", "Cargo.toml", "go.mod",
  "pyproject.toml", "pom.xml", "build.gradle",
  "tsconfig.json", "tsconfig.base.json",
  "next.config.js", "next.config.ts", "next.config.mjs",
  "vite.config.ts", "vite.config.js",
  ".env.example", ".env.sample", ".env.template",
  "docker-compose.yml", "docker-compose.yaml", "Dockerfile",
  "prisma/schema.prisma",
  "auth.ts", "auth.js",
  "app/layout.tsx", "src/App.tsx", "src/main.ts", "src/main.tsx",
  "src/index.ts", "src/index.tsx", "main.go", "cmd/main.go",
  "types/index.ts", "types.ts", "src/types.ts",
];

// Directories to sample a few files from
const SAMPLE_DIRS = ["lib/", "src/", "app/", "components/", "services/", "api/"];

export async function POST(req: NextRequest) {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  let githubToken = cookieStore.get("kb_gh_token")?.value;
  if (!githubToken) {
    const stored = await loadGitHubToken(session.accessToken).catch(() => null);
    if (stored) githubToken = stored.token;
  }
  if (!githubToken) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }

  const { owner, repo } = await req.json() as { owner: string; repo: string };

  // Check if .kb already exists in the repo
  const existingKb = await fetchFileContent(owner, repo, ".kb", githubToken);
  if (existingKb) {
    const tbdCount = (existingKb.match(/\[TBD\]/g) ?? []).length;
    return NextResponse.json({
      kb: existingKb,
      owner,
      repo,
      tbdCount,
      fileCount: 0,
      existing: true,
      message: tbdCount > 0
        ? `I found an existing **.kb** file for **${owner}/${repo}** with ${tbdCount} fields still marked \`[TBD]\`. Let's finish filling those in — I'll guide you through each one.`
        : `I found a complete **.kb** file for **${owner}/${repo}**. Everything looks filled in. You can review it on the right, update anything that's changed, or save it again to refresh the file in the repo.`,
    });
  }

  // Fetch repo metadata
  const repoRes = await fetch(`${GH}/repos/${owner}/${repo}`, {
    headers: ghHeaders(githubToken),
    cache: "no-store",
  });
  if (!repoRes.ok) {
    return NextResponse.json({ error: "Repository not found or not accessible" }, { status: 404 });
  }
  const repoMeta = await repoRes.json() as {
    name: string;
    description: string | null;
    language: string | null;
    default_branch: string;
    html_url: string;
    topics: string[];
    private: boolean;
  };

  // Fetch the recursive file tree
  const treeRes = await fetch(
    `${GH}/repos/${owner}/${repo}/git/trees/${repoMeta.default_branch}?recursive=1`,
    { headers: ghHeaders(githubToken), cache: "no-store" }
  );
  const treeData = await treeRes.json() as { tree?: { path: string; type: string }[] };
  const allPaths = (treeData.tree ?? [])
    .filter((t) => t.type === "blob")
    .map((t) => t.path);

  // Build fetch list: priority files that exist + samples from key dirs
  const toFetch = PRIORITY_FILES.filter((f) => allPaths.includes(f));

  for (const dir of SAMPLE_DIRS) {
    const dirFiles = allPaths.filter(
      (p) => p.startsWith(dir) && p.split("/").length <= dir.split("/").length + 2
    );
    for (const f of dirFiles.slice(0, 3)) {
      if (!toFetch.includes(f)) toFetch.push(f);
    }
  }

  // Fetch file contents in parallel (cap at 18 files, 4000 chars each)
  const fileResults = await Promise.all(
    toFetch.slice(0, 18).map(async (path) => {
      const content = await fetchFileContent(owner, repo, path, githubToken!);
      return content ? { path, content: content.slice(0, 4000) } : null;
    })
  );
  const files = fileResults.filter((f): f is { path: string; content: string } => f !== null);

  const filesText = files
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const dirTree = buildDirTree(allPaths);
  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are a master software architect creating the initial .kb (KnowledgeBase) file for a GitHub repository.

The .kb file is the single authoritative reference document that any AI coding agent reads before starting work on this codebase. It must be accurate, specific, and genuinely useful.

KnowledgeBase Schema (.kbs) — follow this structure exactly:
${KBS_TEMPLATE}

---
REPOSITORY: ${owner}/${repo}
GitHub description: ${repoMeta.description ?? "none"}
Primary language: ${repoMeta.language ?? "unknown"}
Private: ${repoMeta.private}
Topics: ${repoMeta.topics?.join(", ") || "none"}
URL: ${repoMeta.html_url}
Default branch: ${repoMeta.default_branch}

DIRECTORY STRUCTURE (depth 3, files omitted):
${dirTree || "(empty repository)"}

KEY FILES (${files.length} fetched):
${filesText || "(no readable files found)"}
---

INSTRUCTIONS:
1. Fill every field you can determine accurately from the analysis above — be specific, not generic
2. For fields requiring context you cannot infer from code (business rationale, domain rules, hard-won gotchas, lessons learned), use the exact string "[TBD]" as the value
3. Set current_state.as_of to today: ${today}
4. The agent_context.gotchas section is the highest-value section — infer every gotcha you can see in the code (token expiry patterns, schema sync requirements, type constraints, etc.)
5. For architecture.decisions, infer choices from what you see (e.g., if there's no database folder, that's a decision)
6. Return ONLY valid YAML — no markdown fences, no preamble, no explanation, just the raw YAML starting with a comment header
7. Start with: # .kb — KnowledgeBase for ${owner}/${repo}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = response.content.find((b) => b.type === "text")?.text ?? "";
  const kb = rawText.replace(/^```ya?ml\n?/, "").replace(/\n?```$/, "").trim();

  const tbdCount = (kb.match(/\[TBD\]/g) ?? []).length;

  return NextResponse.json({
    kb,
    owner,
    repo,
    tbdCount,
    fileCount: files.length,
    existing: false,
    message: `I've analysed **${owner}/${repo}** — read ${files.length} files and pre-filled everything I could determine from the code.\n\n${tbdCount > 0 ? `There are **${tbdCount} fields** marked \`[TBD]\` that need your input — these are things only you know: the *why* behind architectural decisions, hard-won gotchas, domain rules, and current priorities.\n\nLet's go through them together. I'll ask focused questions section by section.` : `Everything looks fully filled in from the code analysis. Review the KB on the right and let me know if anything needs adjusting.`}`,
  });
}
