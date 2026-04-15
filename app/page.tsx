"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AuthButton } from "@/components/AuthButton";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { TextInput } from "@/components/TextInput";
import { InterpretationCard } from "@/components/InterpretationCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { ConversationHistory } from "@/components/ConversationHistory";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import { useTTS } from "@/hooks/useTTS";
import { useHistory } from "@/hooks/useHistory";
import { GodMode } from "@/components/GodMode";
import { DevMode } from "@/components/DevMode";
import { GitHubButton } from "@/components/GitHubButton";
import type { ConversationEntry } from "@/hooks/useHistory";

const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME;
const formattedBuild = BUILD_TIME
  ? new Date(BUILD_TIME).toLocaleString("sv-SE", {
      timeZone: "Europe/Stockholm",
      dateStyle: "short",
      timeStyle: "short",
    })
  : null;

type InputTab = "voice" | "text";
type DeployState = "ready" | "building" | "error";

const deployDot: Record<DeployState, { color: string; title: string }> = {
  ready:    { color: "bg-green-500",  title: "Deployment succeeded" },
  building: { color: "bg-yellow-400", title: "Deploying…" },
  error:    { color: "bg-red-500",    title: "Deployment failed" },
};

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<InputTab>("voice");
  const [activityKey, setActivityKey] = useState(0);
  const [godMode, setGodMode] = useState<{ active: boolean; initialMessage: string }>({ active: false, initialMessage: "" });
  const [devMode, setDevMode] = useState<{ active: boolean; initialMessage: string }>({ active: false, initialMessage: "" });
  const [deployState, setDeployState] = useState<DeployState>("ready");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function poll() {
      fetch("/api/deploy-status")
        .then((r) => r.json())
        .then((d: { state?: DeployState }) => {
          const s = d.state ?? "ready";
          setDeployState(s);
          // Poll faster while a build is in progress, slower otherwise
          timer = setTimeout(poll, s === "building" ? 5000 : 10000);
        })
        .catch(() => {
          timer = setTimeout(poll, 10000);
        });
    }

    // Re-check immediately when the tab becomes visible
    function onVisible() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    }

    poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const {
    kbStatus,
    currentIntent,
    lastResult,
    message,
    error,
    requiresConfirmation,
    processInput,
    confirmOperation,
    cancelOperation,
    reset,
  } = useKBAdapter();

  const { isEnabled: ttsEnabled, isSupported: ttsSupported, selectedVoiceId, toggle: toggleTTS, selectVoice, speak, stop } = useTTS();
  const { entries: historyEntries, loading: historyLoading, saveMessage, updateEntry, remove: removeEntry } = useHistory();
  const spokenMessageRef = useRef<string | null>(null);
  const pendingHistoryId = useRef<string | null>(null);

  // Speak response when result arrives
  useEffect(() => {
    const shouldSpeak =
      message &&
      message !== spokenMessageRef.current &&
      (kbStatus === "success" || kbStatus === "error" || kbStatus === "clarification_needed");
    if (shouldSpeak) {
      spokenMessageRef.current = message;
      speak(message);
    }
  }, [kbStatus, message, speak]);

  // Update history entry when result arrives
  useEffect(() => {
    if (!pendingHistoryId.current) return;
    if (kbStatus === "success" && message) {
      updateEntry(pendingHistoryId.current, "success", message);
      pendingHistoryId.current = null;
    } else if (kbStatus === "error") {
      updateEntry(pendingHistoryId.current, "error", message ?? error ?? "Error");
      pendingHistoryId.current = null;
    }
  }, [kbStatus, message, error, updateEntry]);

  // Stop TTS on reset
  useEffect(() => {
    if (kbStatus === "idle") {
      stop();
      spokenMessageRef.current = null;
    }
  }, [kbStatus, stop]);

  const isAuthenticated = !!session?.user;
  const isProcessing = kbStatus === "processing" || kbStatus === "executing";
  const showResult =
    currentIntent &&
    (kbStatus === "success" ||
      kbStatus === "error" ||
      kbStatus === "awaiting_confirmation" ||
      kbStatus === "clarification_needed");

  async function handleSubmit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    const isGodMode = lower.startsWith("god mode");
    const isDevMode = lower.startsWith("dev mode");
    const inputType = isGodMode ? "god" : isDevMode ? "god" : activeTab;

    // Save message BEFORE processing — so it's never lost
    const histId = saveMessage(trimmed, inputType);
    pendingHistoryId.current = histId;

    if (isGodMode) {
      setGodMode({ active: true, initialMessage: trimmed });
      return;
    }

    if (isDevMode) {
      setDevMode({ active: true, initialMessage: trimmed });
      return;
    }

    await processInput(trimmed, activeTab);
    setActivityKey((k) => k + 1);
  }

  function handleRerun(entry: ConversationEntry) {
    const lower = entry.rawInput.toLowerCase();
    if (lower.startsWith("dev mode")) {
      setDevMode({ active: true, initialMessage: entry.rawInput });
    } else if (entry.inputType === "god" || lower.startsWith("god mode")) {
      setGodMode({ active: true, initialMessage: entry.rawInput });
    } else {
      handleSubmit(entry.rawInput);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-surface-3 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <div>
              <h1 className="text-base font-bold text-text leading-tight">KnowledgeBase</h1>
              {formattedBuild && (
                <Link
                  href="/patches"
                  className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors leading-tight"
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${deployDot[deployState].color} ${deployState === "building" ? "animate-pulse" : ""}`}
                    title={deployDot[deployState].title}
                  />
                  Deployed {formattedBuild}
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <Link
                href="/settings"
                className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                title="Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            )}
            {isAuthenticated && <GitHubButton />}
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {/* Sign in prompt */}
        {!isAuthenticated && status !== "loading" && (
          <div className="rounded-2xl bg-surface border border-surface-3 p-6 text-center">
            <div className="text-4xl mb-3">🔐</div>
            <h2 className="text-base font-semibold text-text mb-2">Sign in to get started</h2>
            <p className="text-sm text-text-muted mb-4">
              Connect your Google account to save knowledge to your Drive.
            </p>
            <div className="flex justify-center">
              <AuthButton />
            </div>
          </div>
        )}

        {/* God Mode */}
        {isAuthenticated && godMode.active && (
          <GodMode
            initialMessage={godMode.initialMessage}
            onExit={() => setGodMode({ active: false, initialMessage: "" })}
          />
        )}

        {/* Dev Mode */}
        {isAuthenticated && devMode.active && (
          <DevMode
            initialMessage={devMode.initialMessage}
            onExit={() => setDevMode({ active: false, initialMessage: "" })}
          />
        )}

        {/* Input area */}
        {isAuthenticated && !godMode.active && !devMode.active && (
          <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
            <div className="flex border-b border-surface-3">
              {(["voice", "text"] as InputTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? "text-accent border-b-2 border-accent bg-accent/5"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {tab === "voice" ? "🎤 Voice" : "✍️ Text"}
                </button>
              ))}
            </div>
            <div className="p-5">
              {activeTab === "voice" ? (
                <VoiceRecorder
                  onSubmit={handleSubmit}
                  disabled={isProcessing}
                  ttsEnabled={ttsEnabled}
                  ttsSupported={ttsSupported}
                  selectedVoiceId={selectedVoiceId}
                  onToggleTTS={toggleTTS}
                  onSelectVoice={selectVoice}
                />
              ) : (
                <TextInput onSubmit={handleSubmit} disabled={isProcessing} />
              )}
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && !godMode.active && !devMode.active && (
          <div className="flex items-center justify-center gap-3 py-4 text-text-muted text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            {kbStatus === "processing" ? "Interpreting your request..." : "Executing operation..."}
          </div>
        )}

        {/* Interpretation card */}
        {showResult && currentIntent && !godMode.active && !devMode.active && (
          <div>
            <InterpretationCard
              intent={currentIntent}
              result={lastResult}
              status={kbStatus}
              message={message}
              requiresConfirmation={requiresConfirmation}
              onConfirm={confirmOperation}
              onCancel={cancelOperation}
            />
            {(kbStatus === "success" || kbStatus === "error") && (
              <button
                onClick={reset}
                className="mt-3 w-full px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text text-sm font-medium transition-colors"
              >
                New request
              </button>
            )}
          </div>
        )}

        {/* Conversation history */}
        {isAuthenticated && (
          <ConversationHistory
            entries={historyEntries}
            loading={historyLoading}
            onRerun={handleRerun}
            onDelete={removeEntry}
          />
        )}

        {/* Activity feed */}
        {isAuthenticated && (
          <div className="rounded-2xl bg-surface border border-surface-3 p-4">
            <ActivityFeed key={activityKey} />
          </div>
        )}
      </main>

      {/* Confirmation dialog */}
      {requiresConfirmation && message && (
        <ConfirmationDialog
          message={message}
          onConfirm={confirmOperation}
          onCancel={cancelOperation}
          isLoading={kbStatus === "executing"}
        />
      )}
    </div>
  );
}

function useKBAdapter() {
  const kb = useKnowledgeBase();
  return {
    kbStatus: kb.status,
    currentIntent: kb.currentIntent,
    lastResult: kb.lastResult,
    message: kb.message,
    error: kb.error,
    requiresConfirmation: kb.requiresConfirmation,
    processInput: kb.processInput,
    confirmOperation: kb.confirmOperation,
    cancelOperation: kb.cancelOperation,
    reset: kb.reset,
  };
}
