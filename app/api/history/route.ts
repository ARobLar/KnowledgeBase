import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  loadConversations,
  upsertConversation,
  deleteConversation,
  ConversationEntry,
} from "@/lib/drive/conversation-store";
import type { Session } from "next-auth";

type SessionWithToken = Session & { accessToken?: string };

export async function GET() {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const entries = await loadConversations(session.accessToken);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json({ entries: [] });
  }
}

export async function POST(req: NextRequest) {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entry = await req.json() as ConversationEntry;
  try {
    await upsertConversation(session.accessToken, entry);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Write failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = (await auth()) as SessionWithToken | null;
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json() as { id: string };
  try {
    await deleteConversation(session.accessToken, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 500 });
  }
}
