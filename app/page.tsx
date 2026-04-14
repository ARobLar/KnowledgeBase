"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AuthButton } from "@/components/AuthButton";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { TextInput } from "@/components/TextInput";
import { InterpretationCard } from "@/components/InterpretationCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";

type InputTab = "voice" | "text";

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<InputTab>("voice");
  const [activityKey, setActivityKey] = useState(0);

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

  const isAuthenticated = !!session?.user;
  const isProcessing = kbStatus === "processing" || kbStatus === "executing";
  const showResult =
    currentIntent &&
    (kbStatus === "success" ||
      kbStatus === "error" ||
      kbStatus === "awaiting_confirmation" ||
      kbStatus === "clarification_needed");

  async function handleSubmit(text: string) {
    const inputType = activeTab;
    await processInput(text, inputType);
    setActivityKey((k) => k + 1);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-surface-3 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <h1 className="text-base font-bold text-text">KnowledgeBase</h1>
          </div>
          <AuthButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-6">
        {/* Sign in prompt */}
        {!isAuthenticated && status !== "loading" && (
          <div className="rounded-2xl bg-surface border border-surface-3 p-6 text-center">
            <div className="text-4xl mb-3">🔐</div>
            <h2 className="text-base font-semibold text-text mb-2">
              Sign in to get started
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Connect your Google account to save knowledge to your Drive.
            </p>
            <div className="flex justify-center">
              <AuthButton />
            </div>
          </div>
        )}

        {/* Input area (only when authenticated) */}
        {isAuthenticated && (
          <div className="rounded-2xl bg-surface border border-surface-3 overflow-hidden">
            {/* Tab switcher */}
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

            {/* Tab content */}
            <div className="p-5">
              {activeTab === "voice" ? (
                <VoiceRecorder
                  onSubmit={handleSubmit}
                  disabled={isProcessing}
                />
              ) : (
                <TextInput
                  onSubmit={handleSubmit}
                  disabled={isProcessing}
                />
              )}
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-3 py-4 text-text-muted text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            {kbStatus === "processing" ? "Interpreting your request..." : "Executing operation..."}
          </div>
        )}

        {/* Interpretation card */}
        {showResult && currentIntent && (
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

// Adapter to alias status field name (avoid collision with next-auth status)
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
