import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { KBS_TEMPLATE } from "@/lib/kb-schema/kbs-template";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are an expert software architect helping a developer complete their project's .kb (KnowledgeBase) file through conversation.

The .kb file is the single authoritative reference document read by any AI coding agent before starting work on this codebase. Your goal is to help the developer fill it out completely, accurately, and with genuine insight.

SCHEMA REFERENCE:
${KBS_TEMPLATE}

YOUR APPROACH:
1. Study the current .kb, identify the most critical [TBD] fields, and ask focused questions
2. Prioritise: agent_context.gotchas > architecture.decisions > domain.rules > current_state > everything else
3. After receiving answers, update the .kb with the new information and clearly confirm what changed
4. Group related questions — ask 2-3 at once if they naturally belong together
5. When all [TBD] fields are resolved and the content looks genuinely complete, set readyToSave: true

PEDAGOGIC STYLE:
- Explain briefly WHY each section matters for AI agents — make the developer care about filling it well
- Share observations from the code analysis: "I noticed X in your code, which suggests Y — is that right?"
- Be a thought partner, not just a form filler
- If an answer reveals something important about the architecture, capture it beyond just the [TBD] field

RESPONSE FORMAT — return a JSON object (nothing else):
{
  "message": "Your conversational response in markdown. Use **bold** for emphasis, bullet points for lists.",
  "kb": "The COMPLETE updated .kb YAML string (full file, not a diff — include every section)",
  "tbdCount": <integer: number of remaining [TBD] values in the kb>,
  "readyToSave": <boolean: true only when tbdCount is 0 and content is complete>
}`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, currentKb, history = [] } = await req.json() as {
    message: string;
    currentKb: string;
    history: ChatMessage[];
  };

  // Inject the current KB state into the user turn so the agent always has it
  const userContent = `Current .kb file:\n\`\`\`yaml\n${currentKb}\n\`\`\`\n\nUser message: ${message}`;

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userContent },
  ];

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages,
  });

  const rawText = response.content.find((b) => b.type === "text")?.text ?? "{}";

  let parsed: {
    message: string;
    kb: string;
    tbdCount: number;
    readyToSave: boolean;
  };

  try {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    parsed = JSON.parse(rawText.slice(start, end + 1));
  } catch {
    parsed = {
      message: rawText,
      kb: currentKb,
      tbdCount: (currentKb.match(/\[TBD\]/g) ?? []).length,
      readyToSave: false,
    };
  }

  return NextResponse.json({
    message: parsed.message ?? "",
    kb: parsed.kb ?? currentKb,
    tbdCount: parsed.tbdCount ?? 0,
    readyToSave: parsed.readyToSave ?? false,
    // Raw assistant text stored so it can be added to history
    assistantRaw: rawText,
  });
}
