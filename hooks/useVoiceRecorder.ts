"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingState = "idle" | "recording" | "processing" | "done" | "error";

interface VoiceRecorderState {
  recordingState: RecordingState;
  liveTranscript: string;
  finalTranscript: string;
  audioBlob: Blob | null;
  error: string | null;
  isWebSpeechAvailable: boolean;
}

interface VoiceRecorderActions {
  startRecording: () => void;
  stopRecording: () => Promise<void>;
  resetRecording: () => void;
  setFinalTranscript: (t: string) => void;
}

// Web Speech API type declarations for browsers that support it
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceRecorder(): VoiceRecorderState & VoiceRecorderActions {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWebSpeechAvailable, setIsWebSpeechAvailable] = useState(false);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsWebSpeechAvailable(!!getSpeechRecognition());
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    setLiveTranscript("");
    setFinalTranscript("");
    setAudioBlob(null);
    chunksRef.current = [];
    setRecordingState("recording");

    // Start MediaRecorder for audio blob capture
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.start(250);
      })
      .catch((err: Error) => {
        setError(`Microphone access denied: ${err.message}`);
        setRecordingState("error");
      });

    // Start Web Speech API for live transcript
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let accumulatedFinal = "";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            accumulatedFinal += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        setLiveTranscript(accumulatedFinal + interim);
        setFinalTranscript(accumulatedFinal + interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn("SpeechRecognition error:", event.error);
      };

      recognition.start();
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<void> => {
    setRecordingState("processing");

    // Stop Web Speech API
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop MediaRecorder and collect blob
    await new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve();
        return;
      }
      const mr = mediaRecorderRef.current;
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        resolve();
      };
      mr.stop();
    });

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setRecordingState("done");
  }, []);

  const resetRecording = useCallback(() => {
    setRecordingState("idle");
    setLiveTranscript("");
    setFinalTranscript("");
    setAudioBlob(null);
    setError(null);
    chunksRef.current = [];
  }, []);

  return {
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
  };
}
