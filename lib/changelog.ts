export interface PatchEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: PatchEntry[] = [
  {
    version: "1.4.0",
    date: "2026-04-14",
    title: "Versioning & patch notes",
    changes: [
      "Deploy timestamp shown in header — always know how fresh your build is",
      "This patch notes page, cataloguing every update",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-04-14",
    title: "Read & query your knowledge base",
    changes: [
      "Ask questions about stored content — 'What recipes do I have?' or 'How do I make pasta carbonara?'",
      "READ_FILE intent: reads a specific file and answers your question based on its content",
      "QUERY intent: lists files in a folder or searches across multiple documents",
      "Fuzzy file matching — finds the closest file even if you don't remember the exact name",
      "Answers are conversational and optimised for TTS readback",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-04-14",
    title: "One-tap voice with spoken responses",
    changes: [
      "Single button toggles recording — tap to start, tap to stop",
      "Recording auto-submits when stopped, no extra button press needed",
      "Responses are read aloud via the device speaker (Web Speech API)",
      "TTS only fires on the Voice tab and cancels on reset",
      "Live transcript shown as read-only feedback while recording",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-14",
    title: "Google Drive folder pinning",
    changes: [
      "Root folder resolved directly via KB_DRIVE_FOLDER_ID env var — no Drive search needed",
      "Eliminates permission errors from searching the wrong folder",
      "Falls back to name-based search in local/dev setups",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-14",
    title: "Initial release",
    changes: [
      "Voice and text input for saving knowledge to Google Drive",
      "AI intent engine: CREATE_FILE, APPEND_FILE, EDIT_FILE, CREATE_FOLDER",
      "Automatic folder routing — recipes, identity, ideas, projects, research, and more",
      "Web Speech API live transcription with Whisper server fallback",
      "Confidence-based confirmation for destructive edits",
      "Activity feed tracking all recent operations",
      "Google OAuth sign-in with Drive access",
    ],
  },
];
