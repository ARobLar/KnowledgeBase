import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { loadGitHubToken } from "@/lib/crypto/token-store";
import { listRepos } from "@/lib/github/github-service";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

export async function GET() {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieStore = await cookies();
  let githubToken = cookieStore.get("kb_gh_token")?.value ?? undefined;
  if (!githubToken) {
    const stored = await loadGitHubToken(session.accessToken).catch(() => null);
    if (stored) githubToken = stored.token;
  }
  if (!githubToken) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    const repos = await listRepos(githubToken);
    return NextResponse.json({ repos });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "GitHub error" }, { status: 500 });
  }
}
