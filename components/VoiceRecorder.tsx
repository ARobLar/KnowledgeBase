"use client";

import { useEffect } from "react";
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

  // When recording stops and we have an audio blob but no web speech transcript,
  // try to get transcript via server-side Whisper
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
      // Whisper unavailable, user can type manually
    }
  }

  const isRecording = recordingState === "recording";
  const isDone = recordingState === "done";
  const hasTranscript = finalTranscript.trim().length > 0;

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Record button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || recordingState === "processing"}
        className={`
          w-24 h-24 rounded-full flex items-center justify-center
          transition-all duration-200 font-medium text-white
          shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
          ${
            isRecording
              ? "bg-error hover:bg-red-600 scale-110 shadow-red-500/30 shadow-xl"
              : "bg-surface-2 hover:bg-surface-3 border-2 border-surface-3"
          }
        `}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? (
          <span className="text-3xl">⏹</span>
        ) : (
          <svg
            className="w-10 h-10"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z" />
          </svg>
        )}
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 text-error text-sm">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
          Recording...
        </div>
      )}

      {!isWebSpeechAvailable && !isRecording && recordingState === "idle" && (
        <p className="text-text-muted text-xs text-center">
          Live transcription not available in this browser.
          <br />
          Audio will be sent to Whisper after you stop.
        </p>
      )}

      {/* Live transcript */}
      {(liveTranscript || isDone) && (
        <div className="w-full">
          <label className="text-xs text-text-muted mb-1 block">
            {isDone ? "Transcript (edit if needed)" : "Live transcript"}
          </label>
          <textarea
            value={finalTranscript}
            onChange={(e) => setFinalTranscript(e.target.value)}
            readOnly={isRecording}
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-surface-3 text-text text-sm resize-none focus:outline-none focus:border-accent transition-colors"
            placeholder="Your speech will appear here..."
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-error text-sm text-center">{error}</p>
      )}

      {/* Action buttons */}
      {isDone && (
        <div className="flex gap-3 w-full">
          <button
            onClick={resetRecording}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text text-sm font-medium transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => {
              if (hasTranscript) {
                onSubmit(finalTranscript.trim());
                resetRecording();
              }
            }}
            disabled={!hasTranscript || disabled}
            className="flex-1 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
