import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("kb_gh_token");
  cookieStore.delete("kb_gh_user");
  return NextResponse.json({ ok: true });
}
