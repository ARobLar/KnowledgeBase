import { interpretIntent } from "../anthropic/anthropic-service";
import { executeDecision } from "./kb-decision-engine";
import { KBIntent, OperationResult, ProcessRequest, ProcessResponse } from "@/types";

export async function processKBRequest(
  request: ProcessRequest,
  accessToken: string
): Promise<ProcessResponse> {
  const { text, inputType, confirmed, pendingIntent } = request;

  // If user is confirming a pending intent
  if (confirmed && pendingIntent) {
    const result = await executeDecision({
      intent: pendingIntent,
      accessToken,
    });
    return {
      intent: pendingIntent,
      result,
      requiresConfirmation: false,
      message: result.message,
    };
  }

  // Interpret the user input
  let intent: KBIntent;
  try {
    intent = await interpretIntent(text);
  } catch (error) {
    const fallbackIntent: KBIntent = {
      intent: "ASK_USER_TO_CLARIFY",
      folder: null,
      folderPath: null,
      fileName: null,
      title: null,
      targetDocument: null,
      contentType: "unknown",
      markdownContent: null,
      shouldAppend: false,
      confidence: 0,
      needsClarification: true,
      clarificationQuestion: "I had trouble understanding that. Could you rephrase?",
      reasoningSummary: `Error interpreting input: ${error instanceof Error ? error.message : String(error)}`,
    };
    return {
      intent: fallbackIntent,
      requiresConfirmation: false,
      message: fallbackIntent.clarificationQuestion!,
    };
  }

  // If clarification needed, return without executing
  if (intent.needsClarification || intent.intent === "ASK_USER_TO_CLARIFY") {
    return {
      intent,
      requiresConfirmation: false,
      message: intent.clarificationQuestion ?? "Could you clarify?",
    };
  }

  // For destructive operations, require confirmation
  const requiresConfirmation =
    intent.intent === "EDIT_FILE" && intent.confidence < 0.95;

  if (requiresConfirmation) {
    return {
      intent,
      requiresConfirmation: true,
      message: `I'm going to ${describeAction(intent)}. Please confirm.`,
    };
  }

  // Execute immediately
  const result = await executeDecision({ intent, accessToken });
  return {
    intent,
    result,
    requiresConfirmation: false,
    message: result.message,
  };
}

function describeAction(intent: KBIntent): string {
  switch (intent.intent) {
    case "CREATE_FILE":
      return `create "${intent.fileName ?? intent.title}" in ${intent.folderPath ?? "KnowledgeBase"}`;
    case "EDIT_FILE":
      return `replace content in "${intent.targetDocument ?? intent.fileName}"`;
    case "APPEND_FILE":
      return `append to "${intent.targetDocument ?? intent.fileName}"`;
    case "CREATE_FOLDER":
      return `create folder "${intent.folder}"`;
    default:
      return "perform this operation";
  }
}
