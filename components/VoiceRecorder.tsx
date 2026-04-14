"use client";

import { useEffect, useRef } from "react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

interface VoiceRecorderProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onSubmit, disabled }: VoiceRecorderProps) {
  const {
    recordingState,
    liveTranscript,
    finalTranscript,
    audioBlob,
    error,
    isWebSpeechAvailable,
    startRecording,
    stopRecording,
    resetRecording,
    setFinalTranscript,
  } = useVoiceRecorder();

  const hasAutoSubmitted = useRef(false);

  // Server-side Whisper transcription fallback
  useEffect(() => {
    if (
      recordingState === "done" &&
      audioBlob &&
      !finalTranscript.trim() &&
      !isWebSpeechAvailable
    ) {
      transcribeViaServer(audioBlob);
    }
  }, [recordingState, audioBlob, finalTranscript, isWebSpeechAvailable]);

  // Auto-submit when transcript is ready after stopping
  useEffect(() => {
    if (
      recordingState === "done" &&
      finalTranscript.trim() &&
      !hasAutoSubmitted.current &&
      !disabled
    ) {
      hasAutoSubmitted.current = true;
      onSubmit(finalTranscript.trim());
      resetRecording();
      hasAutoSubmitted.current = false;
    }
  }, [recordingState, finalTranscript, disabled]);

  async function transcribeViaServer(blob: Blob) {
    const formData = new FormData();
    formData.append("audio", blob, "audio.webm");
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = (await res.json()) as { transcript: string };
        setFinalTranscript(data.transcript);
      }
    } catch {
      // Whisper unavailable
    }
  }

  const isRecording = recordingState === "recording";
  const isProcessingTranscript = recordingState === "done";

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      {/* Single toggle button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessingTranscript}
        className={`
          w-24 h-24 rounded-full flex items-center justify-center
          transition-all duration-200 shadow-lg
          disabled:opacity-50 disabled:cursor-not-allowed
          ${
            isRecording
              ? "bg-error hover:bg-red-600 scale-110 shadow-red-500/30 shadow-xl"
              : "bg-surface-2 hover:bg-surface-3 border-2 border-surface-3"
          }
        `}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? (
          <span className="text-3xl text-white">⏹</span>
        ) : (
          <svg className="w-10 h-10 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
          </svg>
        )}
      </button>

      {/* Status label */}
      {isRecording && (
        <div className="flex items-center gap-2 text-error text-sm">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
          Recording — tap to stop
        </div>
      )}

      {!isRecording && !isProcessingTranscript && recordingState === "idle" && (
        <p className="text-text-muted text-xs text-center">
          {isWebSpeechAvailable
            ? "Tap to start recording"
            : "Tap to record — audio sent to Whisper"}
        </p>
      )}

      {/* Live transcript (read-only feedback) */}
      {liveTranscript && isRecording && (
        <div className="w-full">
          <p className="text-xs text-text-muted mb-1">Hearing...</p>
          <p className="text-sm text-text bg-surface-2 rounded-xl px-4 py-3 italic">
            {liveTranscript}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-error text-sm text-center">{error}</p>
      )}
    </div>
  );
}
