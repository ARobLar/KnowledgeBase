"use client";

import { useCallback, useEffect, useState } from "react";
import { makeTitle } from "@/lib/utils/make-title";

export interface ConversationEntry {
  id: string;
  title: string;
  preview: string;
  rawInput: string;
  inputType: "voice" | "text" | "god";
  timestamp: string;
  status: "pending" | "success" | "error";
  resultMessage?: string;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useHistory() {
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d: { entries?: ConversationEntry[] }) => {
        setEntries(d.entries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((entry: ConversationEntry) => {
    // Fire-and-forget — don't block the UI
    fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }, []);

  // Call BEFORE sending to API — saves the message immediately
  const saveMessage = useCallback(
    (rawInput: string, inputType: "voice" | "text" | "god"): string => {
      const id = genId();
      const entry: ConversationEntry = {
        id,
        title: makeTitle(rawInput),
        preview: rawInput.slice(0, 120),
        rawInput,
        inputType,
        timestamp: new Date().toISOString(),
        status: "pending",
      };
      setEntries((prev) => [entry, ...prev]);
      persist(entry);
      return id;
    },
    [persist]
  );

  const updateEntry = useCallback(
    (id: string, status: "success" | "error", resultMessage?: string) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status, resultMessage } : e))
      );
      setEntries((prev) => {
        const updated = prev.find((e) => e.id === id);
        if (updated) persist({ ...updated, status, resultMessage });
        return prev;
      });
    },
    [persist]
  );

  const remove = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    },
    []
  );

  return { entries, loading, saveMessage, updateEntry, remove };
}
