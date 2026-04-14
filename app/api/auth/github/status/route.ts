import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("kb_gh_user")?.value;
  const hasToken = !!cookieStore.get("kb_gh_token")?.value;

  if (!hasToken || !userCookie) {
    return NextResponse.json({ connected: false });
  }

  try {
    const user = JSON.parse(userCookie) as { login: string; name: string };
    return NextResponse.json({ connected: true, login: user.login, name: user.name });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
