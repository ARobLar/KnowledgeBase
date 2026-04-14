"use client";

import { useEffect, useState } from "react";
import { ActivityEntry } from "@/types";
import { getRecent, clearActivity } from "@/lib/activity/activity-service";

const actionEmoji: Record<string, string> = {
  CREATE_FILE: "📄",
  CREATE_FOLDER: "📁",
  EDIT_FILE: "✏️",
  APPEND_FILE: "➕",
  ASK_USER_TO_CLARIFY: "❓",
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setEntries(getRecent(10));
  }, []);

  function handleClear() {
    clearActivity();
    setEntries([]);
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-text-muted text-sm">
        No activity yet. Start by saving something!
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide">
          Recent Activity
        </h3>
        <button
          onClick={handleClear}
          className="text-xs text-text-muted hover:text-text transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface-2 border ${
              entry.result.success
                ? "border-surface-3"
                : "border-error/20"
            }`}
          >
            <span className="text-lg flex-shrink-0">
              {actionEmoji[entry.result.action] ?? "•"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-text truncate">
                  {entry.intent.title ?? entry.result.path ?? entry.result.action}
                </span>
                {entry.inputType === "voice" && (
                  <span className="text-xs text-text-muted">🎤</span>
                )}
              </div>
              <p className="text-xs text-text-muted truncate">
                {entry.result.success ? entry.result.path : entry.result.error}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-xs text-text-muted">{timeAgo(entry.timestamp)}</span>
              {entry.result.driveUrl && (
                <a
                  href={entry.result.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-accent hover:underline mt-0.5"
                >
                  Drive ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
