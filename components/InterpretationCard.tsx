"use client";

import { KBIntent, OperationResult } from "@/types";

interface InterpretationCardProps {
  intent: KBIntent;
  result?: OperationResult | null;
  status: string;
  message: string | null;
  requiresConfirmation: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const actionColors: Record<string, string> = {
  CREATE_FILE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CREATE_FOLDER: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  EDIT_FILE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  APPEND_FILE: "bg-green-500/10 text-green-400 border-green-500/20",
  READ_FILE: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  QUERY: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  GITHUB_CREATE_REPO: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  GITHUB_PUSH_FILE: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  GITHUB_CREATE_BRANCH: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ASK_USER_TO_CLARIFY: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const actionLabels: Record<string, string> = {
  CREATE_FILE: "Create File",
  CREATE_FOLDER: "Create Folder",
  EDIT_FILE: "Edit File",
  APPEND_FILE: "Append to File",
  READ_FILE: "Read File",
  QUERY: "Query",
  GITHUB_CREATE_REPO: "GitHub: Create Repo",
  GITHUB_PUSH_FILE: "GitHub: Push File",
  GITHUB_CREATE_BRANCH: "GitHub: Create Branch",
  ASK_USER_TO_CLARIFY: "Need Clarification",
};

export function InterpretationCard({
  intent,
  result,
  status,
  message,
  requiresConfirmation,
  onConfirm,
  onCancel,
}: InterpretationCardProps) {
  const actionStyle = actionColors[intent.intent] ?? "bg-surface-3 text-text border-surface-3";
  const confidencePct = Math.round(intent.confidence * 100);
  const confidenceColor =
    intent.confidence >= 0.8
      ? "text-success"
      : intent.confidence >= 0.6
      ? "text-warning"
      : "text-error";

  return (
    <div className="w-full rounded-2xl bg-surface border border-surface-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
        <span
          className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${actionStyle}`}
        >
          {actionLabels[intent.intent] ?? intent.intent}
        </span>
        <span className={`text-xs font-medium ${confidenceColor}`}>
          {confidencePct}% confidence
        </span>
      </div>

      {/* Details */}
      <div className="px-4 py-4 space-y-3">
        {intent.title && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted uppercase tracking-wide">Title</span>
            <span className="text-sm text-text font-medium">{intent.title}</span>
          </div>
        )}
        {intent.folderPath && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted uppercase tracking-wide">Path</span>
            <span className="text-sm text-text font-mono bg-surface-2 px-2 py-1 rounded">
              {intent.folderPath}/{intent.fileName ?? ""}
            </span>
          </div>
        )}
        {intent.contentType && intent.contentType !== "unknown" && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted uppercase tracking-wide">Content type</span>
            <span className="text-sm text-text capitalize">{intent.contentType}</span>
          </div>
        )}
        {intent.reasoningSummary && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-text-muted uppercase tracking-wide">Reasoning</span>
            <span className="text-sm text-text-muted">{intent.reasoningSummary}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`rounded-xl px-3 py-2.5 text-sm ${
              result.success
                ? "bg-success/10 text-success border border-success/20"
                : "bg-error/10 text-error border border-error/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{result.success ? "✓" : "✗"}</span>
              <span>{result.message}</span>
            </div>
            {result.driveUrl && (
              <a
                href={result.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 block text-xs underline opacity-80 hover:opacity-100"
              >
                Open in Google Drive →
              </a>
            )}
            {result.error && (
              <p className="mt-1 text-xs opacity-70">{result.error}</p>
            )}
          </div>
        )}

        {/* Clarification */}
        {(status === "clarification_needed" ||
          intent.intent === "ASK_USER_TO_CLARIFY") &&
          message && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl px-3 py-2.5">
              <p className="text-sm text-warning">{message}</p>
            </div>
          )}

        {/* Confirmation buttons */}
        {requiresConfirmation && (
          <div className="flex gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
