import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get("gh_oauth_state")?.value;

  // Validate CSRF state
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL("/?gh_error=state_mismatch", req.nextUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?gh_error=no_code", req.nextUrl.origin));
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL(`/?gh_error=${tokenData.error ?? "token_failed"}`, req.nextUrl.origin));
  }

  // Fetch GitHub user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
    },
  });
  const ghUser = await userRes.json() as { login: string; name: string };

  // Store token and user in httpOnly cookies
  cookieStore.set("kb_gh_token", tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  cookieStore.set("kb_gh_user", JSON.stringify({ login: ghUser.login, name: ghUser.name }), {
    httpOnly: false, // readable by JS so the UI can show the username
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  cookieStore.delete("gh_oauth_state");

  return NextResponse.redirect(new URL("/?gh_connected=1", req.nextUrl.origin));
}
