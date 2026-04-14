import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { loadGitHubToken } from "@/lib/crypto/token-store";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

export async function GET() {
  const cookieStore = await cookies();

  // Fast path: cookie is present
  const cookieToken = cookieStore.get("kb_gh_token")?.value;
  const cookieUser = cookieStore.get("kb_gh_user")?.value;
  if (cookieToken && cookieUser) {
    try {
      const user = JSON.parse(cookieUser) as { login: string; name: string };
      return NextResponse.json({ connected: true, login: user.login, name: user.name });
    } catch { /* fall through */ }
  }

  // Slow path: no cookie — try loading from Drive (different device or cleared cookies)
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) {
    return NextResponse.json({ connected: false });
  }

  try {
    const stored = await loadGitHubToken(session.accessToken);
    if (!stored) return NextResponse.json({ connected: false });

    // Restore the cookie for subsequent fast-path requests
    cookieStore.set("kb_gh_token", stored.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    cookieStore.set("kb_gh_user", JSON.stringify({ login: stored.login, name: stored.name }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return NextResponse.json({ connected: true, login: stored.login, name: stored.name });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
