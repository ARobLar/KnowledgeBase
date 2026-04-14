import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { transcribeAudio } from "@/lib/transcription/transcription-service";
import type { Session } from "next-auth";

export async function POST(req: NextRequest) {
  const session = (await auth()) as Session | null;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let audioBlob: Blob;
  try {
    const formData = await req.formData();
    const file = formData.get("audio");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing audio file in form data" },
        { status: 400 }
      );
    }
    audioBlob = file;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse form data" },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Whisper transcription is not configured (OPENAI_API_KEY missing). Use Web Speech API or type your input.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await transcribeAudio(audioBlob);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/transcribe] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Transcription failed",
      },
      { status: 500 }
    );
  }
}
