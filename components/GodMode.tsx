"use client";

import { useState, useRef, useEffect } from "react";
import { useTTS } from "@/hooks/useTTS";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GodModeProps {
  initialMessage: string;
  onExit: () => void;
}

export function GodMode({ initialMessage, onExit }: GodModeProps) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { speak, isEnabled: ttsEnabled } = useTTS();

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, actionLog]);

  // Send initial message on mount
  useEffect(() => {
    sendMessage(initialMessage, []);
  }, []);

  async function sendMessage(text: string, currentHistory: ChatMessage[]) {
    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...currentHistory, userMsg];
    setHistory(newHistory);
    setIsWorking(true);
    setWaitingForUser(false);

    try {
      const res = await fetch("/api/god", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: currentHistory }),
      });

      const data = await res.json() as {
        message: string;
        question: string | null;
        waitingForUser: boolean;
        actionResults: string[];
        assistantMessage: string;
      };

      const assistantMsg: ChatMessage = { role: "assistant", content: data.assistantMessage };
      const updatedHistory = [...newHistory, assistantMsg];
      setHistory(updatedHistory);

      if (data.actionResults?.length > 0) {
        setActionLog((prev) => [...prev, ...data.actionResults]);
      }

      setWaitingForUser(data.waitingForUser ?? false);

      if (ttsEnabled && data.message) {
        speak(data.message);
      }
    } catch (e) {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: JSON.stringify({ message: `Error: ${e instanceof Error ? e.message : "Unknown error"}`, actions: [], waitingForUser: false, question: null }),
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
    sendMessage(text, history);
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
    <div className="flex flex-col h-full rounded-2xl bg-surface border border-violet-500/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-3 bg-violet-500/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-violet-400">⚡ God Mode</span>
          {isWorking && (
            <div className="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
          )}
        </div>
        <button
          onClick={onExit}
          className="text-xs text-text-muted hover:text-text transition-colors px-2 py-1 rounded hover:bg-surface-2"
        >
          Exit
        </button>
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-96">
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
                <p>{message}</p>
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
        <div className="px-4 py-2 border-t border-surface-3 max-h-24 overflow-y-auto">
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
          placeholder={waitingForUser ? "Agent is waiting for your reply..." : "Continue the conversation..."}
          disabled={isWorking}
          className={`flex-1 px-3 py-2 rounded-xl bg-surface-2 border text-text text-sm focus:outline-none transition-colors ${
            waitingForUser ? "border-warning/50 focus:border-warning" : "border-surface-3 focus:border-accent"
          }`}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isWorking}
          className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
