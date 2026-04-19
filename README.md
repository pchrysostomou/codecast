# CodeCast 🎙️

> **Real-time live coding platform** with AI annotations, viewer Q&A, session replay, live code execution, and emoji reactions.

[![CI](https://github.com/pchrysostomou/codecast/actions/workflows/ci.yml/badge.svg)](https://github.com/pchrysostomou/codecast/actions)
[![Deployment](https://img.shields.io/badge/Vercel-deployed-brightgreen)](https://codecast-eta.vercel.app)
[![Socket.io](https://img.shields.io/badge/Railway-live-brightgreen)](https://codecast-production.up.railway.app/health)

**Live Demo:** [codecast-eta.vercel.app](https://codecast-eta.vercel.app)

---

## What is CodeCast?

CodeCast lets developers host **live coding sessions** that viewers can watch in real-time — like a Twitch stream, but built for code. Every keystroke syncs instantly via Socket.io. Viewers can ask AI-powered questions, react with emojis, and watch session replays.

---

## Features

### W1 — Real-Time Live Coding
- Monaco Editor (same engine as VS Code) for the host
- Every keystroke broadcast to all viewers via Socket.io
- Language selector (TypeScript, JavaScript, Python, Java, Go, Rust, C, C++)
- Shareable viewer link — no login required
- Viewer count shown in real-time

### W2 — AI Code Annotations
- Groq (Llama 3.3) analyses code as you type
- Annotations appear in the sidebar with explanations and suggestions
- Throttled to avoid spam — triggers 2s after last keystroke
- Host and viewers both see the AI output

### W3 — Viewer Q&A
- Viewers submit questions about the code being written
- Groq answers with full code context
- Q&A panel synced between host and all viewers
- Questions persist in Supabase

### W4 — Testing & CI/CD
- **Vitest** unit tests for core utilities
- **Playwright** E2E tests (smoke tests, UI navigation)
- **GitHub Actions** CI: Build → TypeScript check → ESLint → Unit Tests → E2E Tests
- CI skips socket-dependent tests automatically (`CI=true` env var)

### W5 — Session Replay
- Every 5 seconds, a code snapshot is saved to Supabase
- `/replay/[sessionId]` page with full playback UI:
  - YouTube-style filled progress bar
  - 56px circular play/pause button with glow effect
  - Speed control: 0.5×, 1×, 2×, 4×
  - Frame counter (current / total)
- Snapshots persist across page refreshes

### W6 — Live Code Execution
- **Run** tab in both host and viewer sidebar
- Host presses **▶ Run** or `Ctrl+Enter` — code executes instantly
- Result broadcast to all viewers via Socket.io
- **JavaScript/TypeScript**: runs in sandboxed Node.js `vm` module (no external API)
- **Python, Java, Go, C, C++, Rust, Bash**: uses Piston API
- Terminal-style output: stdout (white), stderr (red), exit code badge, runtime in ms

### W7 — Live Viewer Reactions
- 6 emoji reactions: 👍 🔥 💡 ❓ 👏 😮
- Viewer clicks → emoji floats up over the editor with animation
- All participants (host + viewers) see reactions in real-time via Socket.io
- Host sees live count badges per emoji
- Glassmorphism reaction bar with `backdrop-filter: blur(8px)`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript |
| **Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Realtime** | Socket.io (client + server) |
| **AI** | Groq API — Llama 3.3 70B |
| **Database** | Supabase (PostgreSQL) |
| **Styling** | Vanilla CSS (custom design system) |
| **Testing** | Vitest (unit) + Playwright (E2E) |
| **CI/CD** | GitHub Actions |
| **Hosting** | Vercel (frontend) + Railway (Socket.io server) |

---

## Architecture

```
┌─────────────┐     Socket.io      ┌──────────────────────┐
│  Host page  │◄──────────────────►│  Railway Socket.io   │
│  /host/:id  │                    │       Server         │
└─────────────┘                    └──────────┬───────────┘
                                              │
┌─────────────┐     Socket.io                 │
│ Viewer page │◄──────────────────────────────┘
│  /s/:id     │
└─────────────┘

┌─────────────┐     REST API       ┌──────────────────────┐
│  Next.js    │◄──────────────────►│  Supabase (Postgres) │
│  API Routes │                    │  - sessions          │
│  /api/run   │                    │  - snapshots         │
│  /api/...   │                    │  - questions         │
└─────────────┘                    └──────────────────────┘
      │
      └──── Groq API (AI annotations + Q&A answers)
      └──── Piston API (Python/Java/Go code execution)
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key

### 1. Clone & install

```bash
git clone https://github.com/pchrysostomou/codecast.git
cd codecast
npm install
cd server && npm install && cd ..
```

### 2. Environment variables

Create `.env.local` in the root:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
GROQ_API_KEY=<your-groq-key>
```

Create `server/.env`:

```env
PORT=3001
FRONTEND_URL=http://localhost:3002
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
GROQ_API_KEY=<your-groq-key>
```

### 3. Database setup

Run in Supabase SQL Editor:

```sql
-- Sessions table
create table codecast_sessions (
  id text primary key,
  language text not null default 'typescript',
  code_snapshot text,
  created_at timestamptz default now(),
  ended_at timestamptz
);

-- Snapshots for replay
create table codecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id text references codecast_sessions(id),
  code text not null,
  language text not null default 'typescript',
  captured_at timestamptz default now()
);

-- Q&A
create table codecast_questions (
  id text primary key,
  session_id text references codecast_sessions(id),
  viewer_name text not null,
  question text not null,
  answer text,
  asked_at timestamptz default now()
);

-- Disable RLS for anon access
alter table codecast_sessions  disable row level security;
alter table codecast_snapshots disable row level security;
alter table codecast_questions disable row level security;
```

### 4. Run locally

```bash
# Terminal 1 — Socket.io server
cd server && npx tsx src/index.ts

# Terminal 2 — Next.js frontend
npm run dev -- --port 3002
```

Open [http://localhost:3002](http://localhost:3002)

---

## Running Tests

```bash
# Unit tests (Vitest)
npm run test:unit

# E2E tests (Playwright)
npm run test:e2e

# TypeScript check
npx tsc --noEmit

# Lint
npm run lint
```

---

## Deployment

### Frontend → Vercel

1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SOCKET_URL` = Railway URL (e.g. `https://codecast-production.up.railway.app`)
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `GROQ_API_KEY` = your Groq API key

### Backend → Railway

1. New project → Deploy from GitHub repo
2. Set **Root Directory** to `server`
3. Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GROQ_API_KEY`, `FRONTEND_URL`
4. Railway auto-assigns `PORT` — do **NOT** hardcode it

---

## Project Structure

```
codecast/
├── app/
│   ├── page.tsx                  # Landing page
│   ├── host/[sessionId]/         # Host coding session
│   ├── s/[sessionId]/            # Viewer page
│   ├── replay/[sessionId]/       # Session replay
│   ├── api/
│   │   ├── sessions/             # Session CRUD + snapshot API
│   │   └── run/                  # Code execution endpoint
│   └── globals.css               # Design system + all component CSS
├── components/
│   ├── CodeEditor.tsx            # Monaco editor (host)
│   ├── CodeViewer.tsx            # Monaco viewer (read-only)
│   ├── ReplayPlayer.tsx          # Replay playback UI
│   ├── AnnotationPanel.tsx       # AI annotation sidebar
│   ├── QAPanel.tsx               # Q&A sidebar
│   ├── RunPanel.tsx              # Code execution terminal
│   └── ReactionsOverlay.tsx      # Live emoji reactions
├── hooks/
│   ├── useSocket.ts              # Socket.io connection hook
│   ├── useAIAnnotation.ts        # AI annotation scheduling
│   └── useViewerName.ts          # Persistent viewer name
├── lib/
│   ├── supabase.ts               # Supabase client
│   └── annotate.ts               # Groq annotation logic
├── server/
│   ├── src/index.ts              # Socket.io server (Express + Socket.io)
│   └── railway.toml              # Railway deployment config
├── e2e/                          # Playwright tests
├── _tests_/                      # Vitest unit tests
└── .github/workflows/ci.yml      # GitHub Actions CI
```

---

## License

MIT — built by [@pchrysostomou](https://github.com/pchrysostomou)
