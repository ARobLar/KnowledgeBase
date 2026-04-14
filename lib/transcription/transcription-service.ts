import { TranscribeResponse } from "@/types";

export async function transcribeAudio(
  audioBlob: Blob
): Promise<TranscribeResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Whisper transcription is unavailable."
    );
  }

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("response_format", "json");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI Whisper API error: ${response.status} — ${error}`);
  }

  const data = (await response.json()) as { text: string };
  return {
    transcript: data.text,
    confidence: 1.0,
  };
}
