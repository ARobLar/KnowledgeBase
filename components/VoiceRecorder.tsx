"use client";

import { useEffect, useRef } from "react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useVoices } from "@/hooks/useVoices";

interface VoiceRecorderProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  ttsEnabled: boolean;
  ttsSupported: boolean;
  selectedVoiceId: string;
  onToggleTTS: () => void;
  onSelectVoice: (id: string) => void;
}

export function VoiceRecorder({ onSubmit, disabled, ttsEnabled, ttsSupported, selectedVoiceId, onToggleTTS, onSelectVoice }: VoiceRecorderProps) {
  const voices = useVoices();
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

      {/* TTS toggle + voice selector */}
      {ttsSupported && (
        <div className="flex flex-col items-center gap-2 w-full">
          <button
            onClick={onToggleTTS}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              ttsEnabled
                ? "bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
                : "bg-surface-2 text-text-muted border-surface-3 hover:text-text"
            }`}
            aria-label={ttsEnabled ? "Disable voice readback" : "Enable voice readback"}
          >
            {ttsEnabled ? (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
                Read aloud on
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
                Read aloud off
              </>
            )}
          </button>

          {ttsEnabled && voices.length > 1 && (
            <select
              value={selectedVoiceId}
              onChange={(e) => onSelectVoice(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-surface-2 border border-surface-3 text-text-muted text-xs focus:outline-none focus:border-accent transition-colors"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          )}
        </div>
      )}

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
