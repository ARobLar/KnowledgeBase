"use client";

import { useState, useCallback } from "react";
import { KBIntent, OperationResult, ActivityEntry, ProcessResponse } from "@/types";
import {
  addActivity,
  generateId,
} from "@/lib/activity/activity-service";

export type KBStatus =
  | "idle"
  | "processing"
  | "awaiting_confirmation"
  | "executing"
  | "success"
  | "error"
  | "clarification_needed";

interface KBState {
  status: KBStatus;
  currentIntent: KBIntent | null;
  lastResult: OperationResult | null;
  message: string | null;
  error: string | null;
  requiresConfirmation: boolean;
}

interface KBActions {
  processInput: (text: string, inputType: "voice" | "text") => Promise<void>;
  confirmOperation: () => Promise<void>;
  cancelOperation: () => void;
  reset: () => void;
}

const initialState: KBState = {
  status: "idle",
  currentIntent: null,
  lastResult: null,
  message: null,
  error: null,
  requiresConfirmation: false,
};

export function useKnowledgeBase(): KBState & KBActions {
  const [state, setState] = useState<KBState>(initialState);
  const [pendingMeta, setPendingMeta] = useState<{
    text: string;
    inputType: "voice" | "text";
    startTime: number;
  } | null>(null);

  const processInput = useCallback(
    async (text: string, inputType: "voice" | "text") => {
      const startTime = Date.now();
      setPendingMeta({ text, inputType, startTime });

      setState((prev) => ({
        ...prev,
        status: "processing",
        error: null,
        message: null,
        currentIntent: null,
        lastResult: null,
      }));

      try {
        const ghToken = localStorage.getItem("kb_github_token");
        const response = await fetch("/api/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(ghToken ? { "x-github-token": ghToken } : {}),
          },
          body: JSON.stringify({ text, inputType }),
        });

        const data = (await response.json()) as ProcessResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? `Server error: ${response.status}`);
        }

        if (data.requiresConfirmation) {
          setState((prev) => ({
            ...prev,
            status: "awaiting_confirmation",
            currentIntent: data.intent,
            requiresConfirmation: true,
            message: data.message,
          }));
          return;
        }

        if (
          data.intent.needsClarification ||
          data.intent.intent === "ASK_USER_TO_CLARIFY"
        ) {
          setState((prev) => ({
            ...prev,
            status: "clarification_needed",
            currentIntent: data.intent,
            message: data.message,
          }));
          return;
        }

        const durationMs = Date.now() - startTime;
        if (data.result) {
          const entry: ActivityEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            inputType,
            rawInput: text,
            intent: data.intent,
            result: data.result,
            durationMs,
          };
          addActivity(entry);
        }

        setState((prev) => ({
          ...prev,
          status: data.result?.success ? "success" : "error",
          currentIntent: data.intent,
          lastResult: data.result ?? null,
          message: data.message,
          error: data.result?.success ? null : (data.result?.error ?? null),
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
          message: "Something went wrong. Please try again.",
        }));
      }
    },
    []
  );

  const confirmOperation = useCallback(async () => {
    if (!state.currentIntent || !pendingMeta) return;

    const startTime = pendingMeta.startTime;
    setState((prev) => ({ ...prev, status: "executing" }));

    try {
      const ghToken = localStorage.getItem("kb_github_token");
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ghToken ? { "x-github-token": ghToken } : {}),
        },
        body: JSON.stringify({
          text: pendingMeta.text,
          inputType: pendingMeta.inputType,
          confirmed: true,
          pendingIntent: state.currentIntent,
        }),
      });

      const data = (await response.json()) as ProcessResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? `Server error: ${response.status}`);
      }

      const durationMs = Date.now() - startTime;
      if (data.result) {
        const entry: ActivityEntry = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          inputType: pendingMeta.inputType,
          rawInput: pendingMeta.text,
          intent: data.intent,
          result: data.result,
          durationMs,
        };
        addActivity(entry);
      }

      setState((prev) => ({
        ...prev,
        status: data.result?.success ? "success" : "error",
        currentIntent: data.intent,
        lastResult: data.result ?? null,
        message: data.message,
        requiresConfirmation: false,
        error: data.result?.success ? null : (data.result?.error ?? null),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        requiresConfirmation: false,
      }));
    }
  }, [state.currentIntent, pendingMeta]);

  const cancelOperation = useCallback(() => {
    setState(initialState);
    setPendingMeta(null);
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    setPendingMeta(null);
  }, []);

  return {
    ...state,
    processInput,
    confirmOperation,
    cancelOperation,
    reset,
  };
}
