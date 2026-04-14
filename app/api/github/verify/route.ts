import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthenticatedUser } from "@/lib/github/github-service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json() as { token: string };
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
    const user = await getAuthenticatedUser(token);
    return NextResponse.json({ login: user.login, name: user.name });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid token" }, { status: 400 });
  }
}
