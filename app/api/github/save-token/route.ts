import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthenticatedUser } from "@/lib/github/github-service";
import { storeGitHubToken } from "@/lib/crypto/token-store";
import { cookies } from "next/headers";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

export async function POST(req: NextRequest) {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await req.json() as { token?: string };
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  // Verify the token with GitHub
  let user: { login: string; name: string };
  try {
    user = await getAuthenticatedUser(token.trim());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid token — could not authenticate with GitHub" }, { status: 400 });
  }

  // Persist to Drive (encrypted) — best-effort; cookie is the fast path
  try {
    await storeGitHubToken(session.accessToken, token.trim(), user.login, user.name ?? user.login);
  } catch {
    // Drive write failed (e.g. expired Google session) — cookie still works for this session
  }

  // Set fast-path cookies regardless of whether Drive write succeeded
  const cookieStore = await cookies();
  cookieStore.set("kb_gh_token", token.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  cookieStore.set("kb_gh_user", JSON.stringify({ login: user.login, name: user.name ?? "" }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });

  return NextResponse.json({ login: user.login, name: user.name ?? "" });
}
