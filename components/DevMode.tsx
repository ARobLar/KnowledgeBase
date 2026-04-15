"use client";

import { useState, useRef, useEffect } from "react";
import { useTTS } from "@/hooks/useTTS";
import Link from "next/link";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ActiveRepo {
  fullName: string;
  private: boolean;
  htmlUrl: string;
}

interface DevModeProps {
  initialMessage: string;
  onExit: () => void;
  onRepoChange?: (repo: ActiveRepo | null) => void;
}

export function DevMode({ initialMessage, onExit, onRepoChange }: DevModeProps) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [activeRepo, setActiveRepo] = useState<ActiveRepo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { speak, isEnabled: ttsEnabled } = useTTS();

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, actionLog, isWorking]);

  // Load active repo then send initial message — must be sequential so the
  // agent receives the correct repo context on the very first turn
  useEffect(() => {
    fetch("/api/github/active-repo")
      .then((r) => r.json())
      .then((d: { repo?: ActiveRepo }) => {
        const repo = d.repo ?? null;
        if (repo) setActiveRepo(repo);
        sendMessage(initialMessage, [], repo);
      })
      .catch(() => {
        sendMessage(initialMessage, [], null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text: string, currentHistory: ChatMessage[], currentRepo: ActiveRepo | null) {
    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...currentHistory, userMsg];
    setHistory(newHistory);
    setIsWorking(true);
    setWaitingForUser(false);

    try {
      const res = await fetch("/api/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: currentHistory, activeRepo: currentRepo }),
      });

      const data = await res.json() as {
        message: string;
        question: string | null;
        waitingForUser: boolean;
        actionResults: string[];
        repoUpdate: ActiveRepo | null;
        assistantMessage: string;
      };

      const assistantMsg: ChatMessage = { role: "assistant", content: data.assistantMessage };
      const updatedHistory = [...newHistory, assistantMsg];
      setHistory(updatedHistory);

      if (data.actionResults?.length > 0) {
        setActionLog((prev) => [...prev, ...data.actionResults]);
      }

      if (data.repoUpdate) {
        setActiveRepo(data.repoUpdate);
        onRepoChange?.(data.repoUpdate);
      }

      setWaitingForUser(data.waitingForUser ?? false);

      if (ttsEnabled && data.message) {
        speak(data.message);
      }
    } catch (e) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: JSON.stringify({ message: `Error: ${e instanceof Error ? e.message : "Unknown error"}`, actions: [], waitingForUser: false, question: null, repoUpdate: null }),
      };
      setHistory((h) => [...h, errMsg]);
    } finally {
      setIsWorking(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isWorking) return;
    setInput("");
    sendMessage(text, history, activeRepo);
  }

  function parseAssistantContent(raw: string): { message: string; question: string | null } {
    try {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const obj = JSON.parse(raw.slice(start, end + 1));
      return { message: obj.message ?? raw, question: obj.question ?? null };
    } catch {
      return { message: raw, question: null };
    }
  }

  return (
    <div className="flex flex-col rounded-2xl bg-surface border border-blue-500/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3 bg-blue-500/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-400">💻 Dev Mode</span>
          {isWorking && (
            <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          )}
        </div>
        <button
          onClick={onExit}
          className="text-xs text-text-muted hover:text-text transition-colors px-2 py-1 rounded hover:bg-surface-2"
        >
          Exit
        </button>
      </div>

      {/* Active repo banner */}
      <div className="px-4 py-2 border-b border-surface-3 bg-surface-2/50 flex items-center gap-2">
        {activeRepo ? (
          <>
            <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <a
              href={activeRepo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-text hover:text-accent transition-colors truncate"
            >
              {activeRepo.fullName}
            </a>
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs border ml-auto ${
              activeRepo.private
                ? "bg-surface-3 text-text-muted border-surface-3"
                : "bg-success/10 text-success border-success/20"
            }`}>
              {activeRepo.private ? "🔒 Private" : "🌐 Public"}
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-text-muted flex-1">No active repository</span>
            <Link
              href="/settings"
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Set in Settings →
            </Link>
          </>
        )}
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-96 min-h-32">
        {history.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="bg-accent/10 border border-accent/20 text-text rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">
                  {msg.content}
                </div>
              </div>
            );
          }
          const { message, question } = parseAssistantContent(msg.content);
          return (
            <div key={i} className="flex justify-start">
              <div className="bg-surface-2 border border-surface-3 text-text rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[85%] space-y-1">
                <p className="whitespace-pre-wrap">{message}</p>
                {question && (
                  <p className="text-warning text-xs border-t border-surface-3 pt-1">{question}</p>
                )}
              </div>
            </div>
          );
        })}

        {isWorking && (
          <div className="flex justify-start">
            <div className="bg-surface-2 border border-surface-3 rounded-2xl rounded-tl-sm px-3 py-2">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action log */}
      {actionLog.length > 0 && (
        <div className="px-4 py-2 border-t border-surface-3 max-h-28 overflow-y-auto bg-surface-2/30">
          <p className="text-xs text-text-muted mb-1 font-medium">Actions taken</p>
          {actionLog.map((log, i) => (
            <p key={i} className="text-xs text-success font-mono truncate">✓ {log}</p>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-surface-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder={waitingForUser ? "Agent is waiting for your reply..." : "Tell the agent what to build..."}
          disabled={isWorking}
          className={`flex-1 px-3 py-2 rounded-xl bg-surface-2 border text-text text-sm focus:outline-none transition-colors ${
            waitingForUser ? "border-warning/50 focus:border-warning" : "border-surface-3 focus:border-blue-400"
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isWorking}
          className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
