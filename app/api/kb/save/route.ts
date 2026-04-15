import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { loadGitHubToken } from "@/lib/crypto/token-store";
import { pushFile } from "@/lib/github/github-service";
import { KBS_TEMPLATE } from "@/lib/kb-schema/kbs-template";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

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

  const { owner, repo, kb } = await req.json() as {
    owner: string;
    repo: string;
    kb: string;
  };

  // Push .kb — the filled knowledge base for this specific repo
  const kbFile = await pushFile(
    githubToken,
    owner,
    repo,
    ".kb",
    kb,
    "Add .kb KnowledgeBase file",
    "main"
  );

  // Push .kbs — the universal schema definition (same for every repo)
  const kbsFile = await pushFile(
    githubToken,
    owner,
    repo,
    ".kbs",
    KBS_TEMPLATE,
    "Add .kbs KnowledgeBase Schema",
    "main"
  );

  return NextResponse.json({
    ok: true,
    kbUrl: kbFile.html_url,
    kbsUrl: kbsFile.html_url,
  });
}
