"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

// ── Types ────────────────────────────────────────────────────────────

interface GHRepo {
  full_name: string;
  html_url: string;
  private: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string; // display text
  raw?: string;    // full raw response for history context
}

type Phase = "select" | "analyzing" | "chat" | "saving" | "saved";

// ── Helpers ──────────────────────────────────────────────────────────

function countTbd(yaml: string): number {
  return (yaml.match(/\[TBD\]/g) ?? []).length;
}

const SECTIONS = [
  "project",
  "architecture",
  "tech_stack",
  "codebase",
  "domain",
  "api",
  "conventions",
  "agent_context",
  "current_state",
] as const;

function sectionTbdCounts(yaml: string): Record<string, number> {
  const counts: Record<string, number> = {};
  const lines = yaml.split("\n");
  let current = "";
  for (const line of lines) {
    const sectionMatch = line.match(/^([a-z_]+):/);
    if (sectionMatch && SECTIONS.includes(sectionMatch[1] as typeof SECTIONS[number])) {
      current = sectionMatch[1];
    }
    if (current && line.includes("[TBD]")) {
      counts[current] = (counts[current] ?? 0) + 1;
    }
  }
  return counts;
}

function completionPct(yaml: string): number {
  if (!yaml) return 0;
  const tbd = countTbd(yaml);
  // Estimate: ~40 fillable fields in a full KB
  const estimated = Math.max(40, tbd);
  return Math.round(((estimated - tbd) / estimated) * 100);
}

// Minimal markdown renderer (bold, code, bullets)
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code class='bg-surface-2 px-1 rounded text-amber-400 text-xs'>$1</code>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/\n/g, "<br/>");
}

// ── Component ─────────────────────────────────────────────────────────

export default function KBStudioPage() {
  const { data: session, status: authStatus } = useSession();

  // Repo selection
  const [repos, setRepos] = useState<GHRepo[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [repoSearch, setRepoSearch] = useState("");

  // Studio state
  const [phase, setPhase] = useState<Phase>("select");
  const [kb, setKb] = useState("");
  const [tbdCount, setTbdCount] = useState(0);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showKB, setShowKB] = useState(true);
  const [saveResult, setSaveResult] = useState<{ kbUrl: string; kbsUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [history, phase]);

  // Load repos
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    setLoadingRepos(true);
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((d: { repos?: GHRepo[]; error?: string }) => {
        setRepos(d.repos ?? []);
      })
      .catch(() => setRepos([]))
      .finally(() => setLoadingRepos(false));
  }, [authStatus]);

  const filteredRepos = (repos ?? []).filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  // ── Analysis ────────────────────────────────────────────────────────

  const analyzeRepo = useCallback(async (owner: string, repo: string) => {
    setPhase("analyzing");
    setError(null);
    setHistory([]);
    setKb("");

    try {
      const res = await fetch("/api/kb/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const data = await res.json() as {
        kb: string;
        tbdCount: number;
        fileCount: number;
        existing: boolean;
        message: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        setError(data.error ?? "Analysis failed");
        setPhase("select");
        return;
      }

      setKb(data.kb);
      setTbdCount(data.tbdCount);
      setHistory([{ role: "assistant", content: data.message }]);
      setPhase("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setPhase("select");
    }
  }, []);

  // ── Chat ────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!text.trim() || sending || !selectedRepo) return;
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);

    try {
      // Build API history from raw responses (excludes current user msg)
      const apiHistory = history.map((m) => ({
        role: m.role,
        content: m.raw ?? m.content,
      }));

      const res = await fetch("/api/kb/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, currentKb: kb, history: apiHistory }),
      });
      const data = await res.json() as {
        message: string;
        kb: string;
        tbdCount: number;
        readyToSave: boolean;
        assistantRaw: string;
      };

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.message,
        raw: data.assistantRaw,
      };
      setHistory([...newHistory, assistantMsg]);
      setKb(data.kb);
      setTbdCount(data.tbdCount);
    } catch (e) {
      setHistory([
        ...newHistory,
        { role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Request failed"}` },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────

  async function saveKB() {
    if (!selectedRepo) return;
    setPhase("saving");
    setError(null);

    try {
      const res = await fetch("/api/kb/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: selectedRepo.owner, repo: selectedRepo.repo, kb }),
      });
      const data = await res.json() as { ok: boolean; kbUrl: string; kbsUrl: string; error?: string };

      if (!data.ok) {
        setError(data.error ?? "Save failed");
        setPhase("chat");
        return;
      }

      setSaveResult({ kbUrl: data.kbUrl, kbsUrl: data.kbsUrl });
      setPhase("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setPhase("chat");
    }
  }

  // ── Section status sidebar ───────────────────────────────────────────

  const sectionCounts = sectionTbdCounts(kb);
  const pct = completionPct(kb);

  // ── Render ───────────────────────────────────────────────────────────

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-text-muted text-sm">Sign in to use KB Studio</p>
          <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm underline">
            ← Back to KnowledgeBase
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface border-b border-surface-3 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-text-muted hover:text-text transition-colors shrink-0 text-sm">
              ← Back
            </Link>
            <div className="w-px h-4 bg-surface-3 shrink-0" />
            <span className="text-sm font-bold text-amber-400 shrink-0">KB Studio</span>
            {selectedRepo && (
              <>
                <div className="w-px h-4 bg-surface-3 shrink-0" />
                <span className="text-sm text-text truncate font-mono">
                  {selectedRepo.owner}/{selectedRepo.repo}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Completion indicator */}
            {kb && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-text-muted tabular-nums">{pct}%</span>
                {tbdCount > 0 && (
                  <span className="text-xs text-amber-400 font-medium">{tbdCount} TBD</span>
                )}
              </div>
            )}

            {/* KB toggle on mobile */}
            {kb && (
              <button
                onClick={() => setShowKB((v) => !v)}
                className="lg:hidden px-3 py-1.5 rounded-lg bg-surface-2 text-xs text-text-muted hover:text-text transition-colors border border-surface-3"
              >
                {showKB ? "Hide KB" : "Show KB"}
              </button>
            )}

            {/* Save button */}
            {phase === "chat" && kb && (
              <button
                onClick={saveKB}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors"
              >
                Save to Repo
              </button>
            )}
            {phase === "saving" && (
              <button disabled className="px-4 py-2 rounded-xl bg-amber-500/50 text-black text-sm font-semibold opacity-60">
                Saving…
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main layout ────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 flex gap-6">

        {/* ── Left: Repo selector OR Chat ──────────────────────── */}
        <div className={`flex flex-col gap-4 ${kb ? "flex-1 min-w-0" : "w-full max-w-lg mx-auto"}`}>

          {/* ── Phase: select repo ──────────────────────────────── */}
          {phase === "select" && (
            <div className="rounded-2xl bg-surface border border-amber-500/20 overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-3 bg-amber-500/5">
                <h2 className="text-sm font-bold text-amber-400">Select a repository to analyse</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  The agent will read the repo structure and key files, then guide you through creating a comprehensive <code className="bg-surface-2 px-1 rounded">.kb</code> knowledge base file.
                </p>
              </div>

              <div className="p-4 space-y-3">
                {error && (
                  <div className="px-3 py-2 rounded-lg bg-error/10 border border-error/20 text-error text-xs">
                    {error}
                  </div>
                )}

                {loadingRepos ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-xl bg-surface-2 animate-pulse" />
                    ))}
                  </div>
                ) : !repos || repos.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-muted mb-3">No GitHub repositories found.</p>
                    <Link href="/settings" className="text-sm text-amber-400 hover:text-amber-300 underline">
                      Connect GitHub in Settings →
                    </Link>
                  </div>
                ) : (
                  <>
                    <input
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Filter repositories…"
                      className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-surface-3 text-text text-sm focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <div className="max-h-80 overflow-y-auto space-y-1 rounded-xl border border-surface-3 p-1">
                      {filteredRepos.map((r) => {
                        const [owner, repo] = r.full_name.split("/");
                        return (
                          <button
                            key={r.full_name}
                            onClick={() => {
                              setSelectedRepo({ owner, repo });
                              analyzeRepo(owner, repo);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-amber-500/10 text-left transition-colors group"
                          >
                            <svg className="w-4 h-4 text-text-muted group-hover:text-amber-400 shrink-0 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-text group-hover:text-amber-300 transition-colors truncate font-mono">
                                {r.full_name}
                              </p>
                            </div>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs border ${
                              r.private
                                ? "bg-surface-3 text-text-muted border-surface-3"
                                : "bg-success/10 text-success border-success/20"
                            }`}>
                              {r.private ? "Private" : "Public"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Phase: analysing ────────────────────────────────── */}
          {phase === "analyzing" && (
            <div className="rounded-2xl bg-surface border border-amber-500/20 p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">
                  Analysing {selectedRepo?.owner}/{selectedRepo?.repo}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Reading repo structure, fetching key files, generating knowledge base…
                </p>
              </div>
            </div>
          )}

          {/* ── Phase: chat ─────────────────────────────────────── */}
          {(phase === "chat" || phase === "saving" || phase === "saved") && (
            <div className="flex flex-col rounded-2xl bg-surface border border-amber-500/20 overflow-hidden" style={{ height: "calc(100vh - 140px)" }}>

              {/* Section status strip */}
              {kb && (
                <div className="px-4 py-2 border-b border-surface-3 flex items-center gap-3 flex-wrap">
                  {SECTIONS.map((s) => {
                    const n = sectionCounts[s] ?? 0;
                    return (
                      <span
                        key={s}
                        className={`text-xs px-2 py-0.5 rounded-full border font-mono transition-colors ${
                          n === 0
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                        }`}
                        title={n > 0 ? `${n} TBD` : "Complete"}
                      >
                        {n > 0 ? `${s} (${n})` : `✓ ${s}`}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Messages */}
              <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {history.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === "user"
                          ? "bg-amber-500/10 border border-amber-500/20 text-text rounded-tr-sm"
                          : "bg-surface-2 border border-surface-3 text-text rounded-tl-sm"
                      }`}
                    >
                      <div
                        className="leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-surface-2 border border-surface-3 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 150, 300].map((d) => (
                          <div
                            key={d}
                            className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Saved state */}
                {phase === "saved" && saveResult && (
                  <div className="rounded-2xl bg-success/10 border border-success/20 p-4 space-y-2">
                    <p className="text-sm font-semibold text-success">
                      ✓ Saved to {selectedRepo?.owner}/{selectedRepo?.repo}
                    </p>
                    <div className="flex flex-col gap-1">
                      <a
                        href={saveResult.kbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline font-mono"
                      >
                        View .kb →
                      </a>
                      <a
                        href={saveResult.kbsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-text-muted hover:text-text font-mono"
                      >
                        View .kbs (schema) →
                      </a>
                    </div>
                    <button
                      onClick={() => {
                        setPhase("select");
                        setSelectedRepo(null);
                        setKb("");
                        setHistory([]);
                        setSaveResult(null);
                      }}
                      className="text-xs text-text-muted hover:text-text transition-colors"
                    >
                      Analyse another repo →
                    </button>
                  </div>
                )}
              </div>

              {/* Input */}
              {phase === "chat" && (
                <div className="px-4 py-3 border-t border-surface-3 flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(input);
                      }
                    }}
                    placeholder="Answer the agent's questions, or ask anything about your KB…"
                    disabled={sending}
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-surface-3 text-text text-sm focus:outline-none focus:border-amber-400 transition-colors resize-none leading-relaxed disabled:opacity-50"
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || sending}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: KB YAML Preview ──────────────────────────── */}
        {kb && (
          <div
            className={`w-96 shrink-0 flex-col rounded-2xl bg-surface border border-surface-3 overflow-hidden ${
              showKB ? "flex" : "hidden lg:flex"
            }`}
            style={{ height: "calc(100vh - 140px)" }}
          >
            <div className="px-4 py-2.5 border-b border-surface-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-muted font-mono">.kb</span>
                <span className="text-xs text-text-muted">—</span>
                <span className="text-xs text-text-muted">{selectedRepo?.owner}/{selectedRepo?.repo}</span>
              </div>
              <div className="flex items-center gap-2">
                {tbdCount > 0 ? (
                  <span className="text-xs text-amber-400">{tbdCount} fields remaining</span>
                ) : (
                  <span className="text-xs text-success">✓ Complete</span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <pre className="p-4 text-xs text-text-muted font-mono leading-relaxed whitespace-pre-wrap break-words">
                {/* Highlight [TBD] in amber */}
                {kb.split("[TBD]").map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span className="text-amber-400 font-bold bg-amber-400/10 rounded px-0.5">
                        [TBD]
                      </span>
                    )}
                  </span>
                ))}
              </pre>
            </div>

            {/* Copy button */}
            <div className="px-4 py-2 border-t border-surface-3">
              <button
                onClick={() => navigator.clipboard.writeText(kb)}
                className="w-full text-xs text-text-muted hover:text-text transition-colors py-1 rounded-lg hover:bg-surface-2"
              >
                Copy to clipboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
