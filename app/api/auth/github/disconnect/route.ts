import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { deleteGitHubToken } from "@/lib/crypto/token-store";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("kb_gh_token");
  cookieStore.delete("kb_gh_user");

  // Also remove from Drive so it doesn't come back on other devices
  const session = (await auth()) as SessionWithToken | null;
  if (session?.accessToken) {
    try {
      await deleteGitHubToken(session.accessToken);
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true });
}
