# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Next.js dev server (http://localhost:3000)
npm run build      # Production build
npm run lint       # ESLint via Next.js
npm run typecheck  # TypeScript check without emit
```

There are no automated tests. `npm run typecheck` is the primary static verification step — run it after any TypeScript changes.

## Environment setup

Copy `.env.example` to `.env.local`. Required variables:
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`

Optional:
- `OPENAI_API_KEY` — Whisper fallback for audio transcription
- `KB_ROOT_FOLDER` — name of the root Drive folder (default: `KnowledgeBase`)
- `KB_DRIVE_FOLDER_ID` — pin to a specific Drive folder ID, skipping the name search

## Architecture

Next.js 14 App Router app. No database — all persistent state lives as files in the user's Google Drive.

### Request pipeline

```
POST /api/process
  → kb-operation-service.ts   (orchestrator — handles confirmation flow)
    → anthropic-service.ts    (Claude claude-opus-4-6 with adaptive thinking → KBIntent JSON)
    → kb-decision-engine.ts   (safety gates + action dispatch)
      → drive-service.ts      (Google Drive CRUD via googleapis)
```

The central type is `KBIntent` (`types/index.ts`) — a Zod-validated JSON object Claude returns. Every field must satisfy `KBIntentSchema` in `anthropic-service.ts` or the call throws and falls back to `ASK_USER_TO_CLARIFY`.

### Drive as the database

There is no SQL. Everything lives as files inside `KnowledgeBase/` in the user's Google Drive:

| File | Contents |
|------|----------|
| Content files | Markdown files in named subfolders |
| `.kb-config` | AES-256-GCM encrypted JSON: GitHub token + active repo (`lib/crypto/token-store.ts`) |
| `.kb-history` | JSON array of up to 100 `ConversationEntry` records (`lib/drive/conversation-store.ts`) |

`KBConfig` holds: `githubToken`, `githubLogin`, `githubName`, `activeRepo` (with `fullName`, `private`, `htmlUrl`).

Root folder resolution (`lib/drive/drive-path-resolver.ts`): if `KB_DRIVE_FOLDER_ID` is set, use it directly; otherwise search by name, creating the folder if absent.

### Auth

Next-Auth v5 (beta) via `auth.ts`. Google OAuth with full `drive` scope. The `accessToken` is stored in the JWT and forwarded to every Drive API call via the session. **Token refresh is not implemented** — tokens expire after ~1 hour and the user must re-sign in.

### GitHub token storage

The GitHub PAT is stored two places:
1. `kb_gh_token` cookie — fast, single-device
2. Encrypted in `.kb-config` on Drive — cross-device fallback

`/api/process` checks the cookie first, then falls back to Drive. The encryption key is derived from `AUTH_SECRET` via SHA-256.

### Decision engine safety rules (`kb-decision-engine.ts`)

- `needsClarification = true` → always returns `ASK_USER_TO_CLARIFY`, never executes
- `EDIT_FILE` with `confidence < 0.8` → blocked (returns error message)
- `EDIT_FILE` with `confidence ≥ 0.8` and `< 0.95` → sets `requiresConfirmation: true`; UI holds `pendingIntent` and re-POSTs with `confirmed: true`
- `EDIT_FILE` / `APPEND_FILE` targeting a non-existent file → falls back to `CREATE_FILE`
- `CREATE_FILE` when file already exists → falls back to `APPEND_FILE`
- `CREATE_FOLDER` when folder already exists → returns error without creating

### Power-user modes

**Dev Mode** (`GET /api/dev`): A multi-turn coding agent. The frontend sends `{ message, history, activeRepo }` and receives a JSON response with `actions[]` that the server executes (GitHub pushes, Drive writes). Claude operates as a full-stack coding agent against the active GitHub repo. Active repo is persisted to `.kb-config` on state changes.

**God Mode** (`POST /api/god`): Raw agentic Claude with the same Drive + GitHub tools as Dev Mode, but without the structured KB intent pipeline. Supports the same action types in its response `actions[]` array.

Both modes use `claude-opus-4-6` with `thinking: { type: "adaptive" }` and return a JSON envelope with `message`, `actions`, `waitingForUser`, `question`.

### API routes

| Route | Purpose |
|-------|---------|
| `POST /api/process` | Main entry point — interprets text/voice and executes KB operations |
| `POST /api/transcribe` | Whisper fallback for audio blobs |
| `GET/POST /api/history` | Load/save conversation history from Drive |
| `GET /api/dev` | Dev Mode — multi-turn coding agent against active GitHub repo |
| `POST /api/god` | God Mode — raw agentic Claude with Drive + GitHub tool use |
| `GET /api/deploy-status` | Polls GitHub Actions for Vercel deploy status |
| `/api/github/*` | GitHub OAuth connect/disconnect, repo listing, active repo |

### Frontend

`app/page.tsx` is the main page, composing `VoiceRecorder`, `TextInput`, `InterpretationCard`, `ActivityFeed`, and `ConversationHistory`. Voice/text input state, `pendingIntent`, and confirmation dialogs are managed locally in `page.tsx`.

`DevMode.tsx` and `GodMode.tsx` are power-user panels toggled from the header. Both maintain their own local conversation `history` arrays for multi-turn context.

### Adding a new KB action

1. Add the action name to `KBAction` in `types/index.ts`
2. Add it to `KBIntentSchema` enum in `lib/anthropic/anthropic-service.ts`
3. Add routing in `kb-decision-engine.ts` `executeDecision` switch
4. Implement the handler function in the same file
5. Update `lib/anthropic/intent-prompt.ts` so Claude knows when to emit the new action
