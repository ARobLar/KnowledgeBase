"use client";

import { useState } from "react";
import { ConversationEntry } from "@/hooks/useHistory";

interface ConversationHistoryProps {
  entries: ConversationEntry[];
  loading: boolean;
  onRerun: (entry: ConversationEntry) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  success: "bg-success/10 text-success border-success/20",
  error: "bg-error/10 text-error border-error/20",
  pending: "bg-surface-3 text-text-muted border-surface-3",
};

const inputIcons: Record<string, string> = {
  voice: "🎤",
  text: "✍️",
  god: "⚡",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ConversationHistory({
  entries,
  loading,
  onRerun,
  onDelete,
}: ConversationHistoryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="rounded-2xl bg-surface border border-surface-3 p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-text">History</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3">
        <h2 className="text-sm font-semibold text-text">History</h2>
        <span className="text-xs text-text-muted">{entries.length} saved</span>
      </div>

      <div className="divide-y divide-surface-3">
        {entries.map((entry) => {
          const isExpanded = expanded === entry.id;
          const isConfirming = confirmDelete === entry.id;

          return (
            <div key={entry.id} className="group">
              <div
                className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : entry.id)}
              >
                {/* Input type icon */}
                <span className="text-sm mt-0.5 shrink-0">{inputIcons[entry.inputType] ?? "💬"}</span>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-text truncate">{entry.title}</p>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs border ${statusColors[entry.status] ?? ""}`}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted">{timeAgo(entry.timestamp)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRerun(entry); }}
                    className="p-1.5 rounded-lg hover:bg-accent/10 text-text-muted hover:text-accent transition-colors"
                    title="Re-run this message"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  {!isConfirming ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(entry.id); }}
                      className="p-1.5 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { onDelete(entry.id); setConfirmDelete(null); }}
                        className="px-2 py-1 rounded text-xs bg-error text-white hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 rounded text-xs text-text-muted hover:text-text transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 bg-surface-2/50">
                  <div className="rounded-xl bg-surface-2 border border-surface-3 px-3 py-2">
                    <p className="text-xs text-text-muted mb-1 font-medium">Your message</p>
                    <p className="text-sm text-text whitespace-pre-wrap break-words">{entry.rawInput}</p>
                  </div>
                  {entry.resultMessage && (
                    <div className={`rounded-xl border px-3 py-2 ${
                      entry.status === "success"
                        ? "bg-success/5 border-success/20"
                        : "bg-error/5 border-error/20"
                    }`}>
                      <p className="text-xs text-text-muted mb-1 font-medium">Response</p>
                      <p className="text-sm text-text whitespace-pre-wrap break-words">{entry.resultMessage}</p>
                    </div>
                  )}
                  <button
                    onClick={() => onRerun(entry)}
                    className="w-full px-4 py-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium transition-colors"
                  >
                    Re-run this message
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
