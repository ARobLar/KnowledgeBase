import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { processKBRequest } from "@/lib/kb/kb-operation-service";
import { loadGitHubToken } from "@/lib/crypto/token-store";
import { ProcessRequest, ProcessResponse } from "@/types";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

export async function POST(req: NextRequest) {
  const session = (await auth()) as SessionWithToken | null;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.accessToken) {
    return NextResponse.json(
      { error: "No Google access token. Please sign in again." },
      { status: 401 }
    );
  }

  let body: ProcessRequest;
  try {
    body = (await req.json()) as ProcessRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.text || typeof body.text !== "string") {
    return NextResponse.json(
      { error: "Missing required field: text" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  let githubToken = cookieStore.get("kb_gh_token")?.value ?? undefined;
  // Fall back to Drive-stored token (cross-device)
  if (!githubToken) {
    try {
      const stored = await loadGitHubToken(session.accessToken);
      if (stored) githubToken = stored.token;
    } catch { /* best-effort */ }
  }

  try {
    const result: ProcessResponse = await processKBRequest(
      body,
      session.accessToken,
      githubToken
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/process] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
