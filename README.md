# KnowledgeBase

A mobile-first AI-powered knowledge base that lets you save thoughts, recipes, research, and personal notes to Google Drive using voice or text — interpreted by Claude.

## Overview

Speak or type naturally. Claude interprets your intent, decides what action to take (create a file, append to an existing doc, create a folder), and executes it against your Google Drive. All content is stored as Markdown files under a `KnowledgeBase/` root folder in your Drive.

## Architecture

```
User Input (voice/text)
       ↓
/api/process
       ↓
anthropic-service.ts  → claude-opus-4-6 with adaptive thinking
       ↓
KBIntent (structured JSON)
       ↓
kb-decision-engine.ts  (safety checks, confidence gating)
       ↓
drive-service.ts  (Google Drive API via googleapis)
       ↓
OperationResult → Activity log → UI feedback
```

### Core services

| File | Purpose |
|------|---------|
| `lib/anthropic/anthropic-service.ts` | Calls Claude claude-opus-4-6, validates JSON response with Zod |
| `lib/anthropic/intent-prompt.ts` | System prompt with routing rules |
| `lib/drive/drive-service.ts` | CRUD operations on Google Drive |
| `lib/drive/drive-path-resolver.ts` | Resolves folder/file paths, creates root structure |
| `lib/kb/kb-decision-engine.ts` | Safety + deterministic logic layer |
| `lib/kb/kb-operation-service.ts` | Orchestrates the full request pipeline |
| `lib/markdown/markdown-service.ts` | Formats content as typed Markdown |
| `lib/activity/activity-service.ts` | localStorage activity log |
| `lib/transcription/transcription-service.ts` | Whisper server-side fallback |

### Key types

```typescript
type KBAction = "CREATE_FOLDER" | "CREATE_FILE" | "EDIT_FILE" | "APPEND_FILE" | "ASK_USER_TO_CLARIFY"
type ContentType = "recipe" | "identity" | "research" | "note" | "idea" | "general" | "unknown"
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ARobLar/KnowledgeBase.git
cd KnowledgeBase
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `AUTH_SECRET` — run `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for local, your Vercel URL for prod

Optional:
- `OPENAI_API_KEY` — enables Whisper transcription fallback
- `KB_ROOT_FOLDER` — override root folder name (default: `KnowledgeBase`)

### 3. Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or select an existing one)
3. Enable **Google Drive API**: APIs & Services → Library → Search "Google Drive API" → Enable
4. Create OAuth credentials: APIs & Services → Credentials → Create Credentials → OAuth Client ID
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://your-vercel-url.vercel.app/api/auth/callback/google` (prod)
5. Copy Client ID and Client Secret to `.env.local`

### 4. Google Drive API

The Drive API is enabled in step 3 above. The app requests `https://www.googleapis.com/auth/drive` scope which allows full Drive access for the authenticated user. Files are stored under `KnowledgeBase/` in the user's own Drive.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and start saving knowledge.

## How voice transcription works

1. **Web Speech API (preferred)**: Available in Chrome/Edge/Safari. Provides live real-time transcript while speaking. Also runs MediaRecorder in parallel to capture audio.
2. **Whisper fallback**: If Web Speech API is unavailable (Firefox, some mobile browsers), the recorded audio blob is sent to `/api/transcribe`, which calls OpenAI Whisper. Requires `OPENAI_API_KEY`.
3. **Manual editing**: The transcript is shown in an editable textarea before submission — the user can correct errors.

## Decision engine

`kb-decision-engine.ts` applies deterministic safety rules on top of Claude's interpretation:

- `needsClarification = true` → always returns `ASK_USER_TO_CLARIFY` without executing
- `EDIT_FILE` with `confidence < 0.8` → blocked with explanation
- `CREATE_FOLDER` → checks if folder already exists before creating
- `EDIT_FILE` or `APPEND_FILE` → if file not found, falls back to `CREATE_FILE`
- `CREATE_FILE` when file already exists → automatically switches to append (non-destructive)

## Content routing

Claude routes content based on semantic meaning:

| Input keywords | Folder | ContentType |
|----------------|--------|-------------|
| recipe, cooking, ingredients | `recipes/` | `recipe` |
| RobinSoulMD, soul doc, identity | `identity/` | `identity` |
| research, study, findings | `research/` | `research` |
| idea, concept, brainstorm | `ideas/` | `idea` |
| project, plan, task | `projects/` | `note` |
| health, workout, supplement | `health-protocols/` | `general` |

## Deployment

### Vercel (recommended)

```bash
vercel --prod
```

Set environment variables in Vercel dashboard (Project → Settings → Environment Variables).

### Manual

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add all env vars
4. Update `NEXTAUTH_URL` to your Vercel deployment URL
5. Add the Vercel callback URL to Google OAuth authorized redirect URIs

## Limitations

- Session tokens are stored in cookies via Auth.js — refresh token rotation is not yet implemented (tokens will expire after ~1 hour without a re-sign-in)
- The activity feed is stored in localStorage only — it does not sync across devices
- No search functionality (yet) — Drive API searches are possible but not implemented
- Large files (>10MB) may hit Drive API limits
- Voice recording requires HTTPS in production (or localhost in dev)

## Next steps

- [ ] Implement token refresh to prevent Drive API failures after token expiry
- [ ] Add full-text search across the KnowledgeBase using Drive API
- [ ] Add a file browser view to see existing KB contents
- [ ] Sync activity log to a Drive file for cross-device persistence
- [ ] Add multi-turn conversation context (remember previous messages)
- [ ] Add support for attaching images/files alongside text content
- [ ] Implement folder-level summaries using Claude
