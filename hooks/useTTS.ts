"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "kb_tts_enabled";
const VOICE_KEY = "kb_tts_voice_id";

export function useTTS() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("origin");

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" && "speechSynthesis" in window
    );
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setIsEnabled(true);
    const storedVoice = localStorage.getItem(VOICE_KEY);
    if (storedVoice) setSelectedVoiceId(storedVoice);
  }, []);

  // Speak a short silent utterance to unlock the engine (must be called from a user gesture)
  const unlock = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance("\u200B"); // zero-width space — inaudible
    u.volume = 0;
    u.onend = () => setIsUnlocked(true);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setIsUnlocked(true);
  }, []);

  const enable = useCallback(() => {
    setIsEnabled(true);
    localStorage.setItem(STORAGE_KEY, "true");
    unlock();
  }, [unlock]);

  const disable = useCallback(() => {
    setIsEnabled(false);
    localStorage.setItem(STORAGE_KEY, "false");
    window.speechSynthesis?.cancel();
  }, []);

  const toggle = useCallback(() => {
    if (isEnabled) {
      disable();
    } else {
      enable();
    }
  }, [isEnabled, enable, disable]);

  const selectVoice = useCallback((id: string) => {
    setSelectedVoiceId(id);
    localStorage.setItem(VOICE_KEY, id);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isEnabled || !isSupported) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1;

      // Apply selected voice if not "origin"
      if (selectedVoiceId !== "origin") {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) => v.name === selectedVoiceId);
        if (match) utterance.voice = match;
      }

      window.speechSynthesis.speak(utterance);
    },
    [isEnabled, isSupported, selectedVoiceId]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  return { isEnabled, isSupported, isUnlocked, selectedVoiceId, toggle, selectVoice, speak, stop };
}
