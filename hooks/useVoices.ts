"use client";

import { useEffect, useState } from "react";

export interface VoiceOption {
  id: string;         // unique key
  label: string;      // display name shown in UI
  voice: SpeechSynthesisVoice | null;  // null = system default (Origin)
}

const QUALITY_KEYWORDS = ["enhanced", "premium", "natural", "neural", "google", "siri", "samantha", "alex", "aria", "zira", "mark", "david", "cortana"];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (v.localService) score += 2; // local = lower latency
  for (const kw of QUALITY_KEYWORDS) {
    if (name.includes(kw)) score += 3;
  }
  if (v.lang.startsWith("en")) score += 1;
  return score;
}

export function useVoices() {
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    function load() {
      const raw = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      if (raw.length === 0) return;

      // Sort by quality score descending
      const sorted = [...raw].sort((a, b) => scoreVoice(b) - scoreVoice(a));

      const opts: VoiceOption[] = [
        { id: "origin", label: "Origin (default)", voice: null },
      ];

      // Add top 5 voices with readable names
      const seen = new Set<string>();
      for (const v of sorted) {
        if (seen.size >= 5) break;
        const key = v.name;
        if (seen.has(key)) continue;
        seen.add(key);
        const label = v.name.replace(/\s*\(.*?\)\s*/g, "").trim() || v.name;
        opts.push({ id: v.name, label, voice: v });
      }

      setVoices(opts);
    }

    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  return voices;
}
