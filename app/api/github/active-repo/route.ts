import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveRepo, setActiveRepo } from "@/lib/crypto/token-store";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

export async function GET() {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const repo = await getActiveRepo(session.accessToken);
  return NextResponse.json({ repo });
}

export async function POST(req: NextRequest) {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as { fullName?: string; private?: boolean; htmlUrl?: string } | null;
  if (!body?.fullName) {
    await setActiveRepo(session.accessToken, null);
    return NextResponse.json({ ok: true });
  }
  await setActiveRepo(session.accessToken, {
    fullName: body.fullName,
    private: body.private ?? false,
    htmlUrl: body.htmlUrl ?? `https://github.com/${body.fullName}`,
  });
  return NextResponse.json({ ok: true });
}
