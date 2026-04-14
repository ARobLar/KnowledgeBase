import Anthropic from "@anthropic-ai/sdk";
import type { ThinkingConfigParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { z } from "zod";
import { KBIntent } from "@/types";
import { INTENT_SYSTEM_PROMPT, STRICT_JSON_REMINDER } from "./intent-prompt";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const KBIntentSchema = z.object({
  intent: z.enum([
    "CREATE_FOLDER",
    "CREATE_FILE",
    "EDIT_FILE",
    "APPEND_FILE",
    "READ_FILE",
    "QUERY",
    "ASK_USER_TO_CLARIFY",
  ]),
  folder: z.string().nullable(),
  folderPath: z.string().nullable(),
  fileName: z.string().nullable(),
  title: z.string().nullable(),
  targetDocument: z.string().nullable(),
  contentType: z.enum([
    "recipe",
    "identity",
    "research",
    "note",
    "idea",
    "general",
    "unknown",
  ]),
  markdownContent: z.string().nullable(),
  shouldAppend: z.boolean(),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  reasoningSummary: z.string(),
});

function extractJson(text: string): string {
  // Strip markdown code blocks if present
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return codeBlock[1].trim();
  // Find first { to last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

const thinkingConfig: ThinkingConfigParam = {
  type: "adaptive",
};

async function callClaude(
  userMessage: string,
  extraSystemNote?: string
): Promise<string> {
  const systemPrompt = extraSystemNote
    ? INTENT_SYSTEM_PROMPT + "\n\n" + extraSystemNote
    : INTENT_SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    thinking: thinkingConfig,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  // Extract text content from response blocks
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Anthropic response");
  }

  return textBlock.text;
}

export async function answerFromContent(
  question: string,
  files: { name: string; content: string }[]
): Promise<string> {
  const filesText = files
    .map((f) => `### ${f.name}\n${f.content}`)
    .join("\n\n---\n\n");

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system:
      "You are a helpful personal knowledge assistant. Answer the user's question concisely based only on the provided file contents. Speak naturally, as if talking to a friend. Keep answers brief and conversational — ideal for being read aloud.",
    messages: [
      {
        role: "user",
        content: `My question: ${question}\n\nMy files:\n\n${filesText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "I couldn't find an answer in your files.";
}

export async function interpretIntent(userInput: string): Promise<KBIntent> {
  let rawText: string;

  try {
    rawText = await callClaude(userInput);
  } catch (error) {
    throw new Error(
      `Anthropic API call failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const jsonText = extractJson(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Retry with stricter instructions
    try {
      const retryText = await callClaude(userInput, STRICT_JSON_REMINDER);
      const retryJson = extractJson(retryText);
      parsed = JSON.parse(retryJson);
    } catch (retryError) {
      throw new Error(
        `Failed to parse Anthropic response as JSON after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`
      );
    }
  }

  const validated = KBIntentSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Invalid KBIntent schema: ${validated.error.message}`
    );
  }

  return validated.data as KBIntent;
}
