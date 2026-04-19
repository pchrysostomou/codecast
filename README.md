# CodeCast

> **Live coding sessions with AI annotations.** Write code, let viewers watch every keystroke in real-time, and have AI explain every change automatically.

[![CI](https://github.com/pchrysostomou/codecast/actions/workflows/ci.yml/badge.svg)](https://github.com/pchrysostomou/codecast/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io)](https://socket.io/)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3-orange)](https://groq.com/)

---

## What It Does

```
🎬 Host starts a session
      ↓
⌨️  Writes code in Monaco Editor (VS Code in the browser)
      ↓
📡  Every keystroke syncs to all viewers in real-time via Socket.io
      ↓
🤖  After 2s of inactivity → AI annotates the change (Groq Llama 3.3)
      ↓
💬  Viewers ask questions → AI answers in context of the current code
```

**Demo:**

| Host View | Viewer View |
|-----------|-------------|
| Write code → AI explains in sidebar | See AI annotations + ask questions |
| See all Q&A from viewers | Auto-named (e.g. `swift_coder482`) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19 |
| **Editor** | Monaco Editor (VS Code engine) |
| **Real-time** | Socket.io (WebSockets) |
| **AI** | Groq API — Llama 3.3 70B Versatile |
| **Database** | Supabase (PostgreSQL) |
| **Styling** | Vanilla CSS, VS Code dark theme |
| **Testing** | Vitest (unit) + Playwright (E2E) |
| **Deploy** | Vercel (frontend) + Railway (server) |

---

## Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   Next.js (Vercel)      │        │  Socket.io Server        │
│                         │        │  (Railway, :3001)        │
│  /host/[sessionId]      │◄──────►│                          │
│  /s/[sessionId]         │        │  - session:join          │
│  /api/annotate          │        │  - code:change           │
│  /api/qa                │        │  - annotation:new        │
│                         │        │  - question:ask → Groq   │
└────────────┬────────────┘        └──────────────────────────┘
             │
             ▼
     ┌───────────────┐
     │  Supabase     │
     │  PostgreSQL   │
     │               │
     │  sessions     │
     │  questions    │
     └───────────────┘
```

**Key flows:**

1. **Code sync** — Host types → 100ms throttle → `code:change` → server stores + broadcasts → viewers see update
2. **AI annotation** — 2s debounce → `computeDiff` → `POST /api/annotate` → Groq → `annotation:new` → broadcast to all
3. **Q&A** — Viewer asks → `question:ask` → server calls Groq with code context → `question:answered` → broadcast

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Groq](https://console.groq.com/) API key (free)
- A [Supabase](https://supabase.com/) project (free)

### 1. Clone & install

```bash
git clone https://github.com/yourusername/codecast.git
cd codecast

# Frontend
npm install

# Server
cd server && npm install
```

### 2. Environment variables

```bash
# Frontend (.env.local)
cp .env.example .env.local

# Server (server/.env)
cp server/.env.example server/.env
```

Fill in your keys:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SOCKET_URL` | Points to your Socket.io server (`http://localhost:3001`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `GROQ_API_KEY` | Groq API key |

### 3. Database setup

Run this in your [Supabase SQL Editor](https://app.supabase.com/):

```sql
CREATE TABLE IF NOT EXISTS codecast_sessions (
  id           TEXT PRIMARY KEY,
  language     TEXT DEFAULT 'typescript',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  code_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS codecast_questions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  TEXT REFERENCES codecast_sessions(id) ON DELETE CASCADE,
  viewer_name TEXT DEFAULT 'guest',
  question    TEXT NOT NULL,
  answer      TEXT,
  asked_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Run locally

```bash
# Terminal 1 — Socket.io server
cd server && npm run dev     # → http://localhost:3001

# Terminal 2 — Next.js
npm run dev -- --port 3002   # → http://localhost:3002
```

Visit `http://localhost:3002`, click **Start coding →**, share the viewer link!

---

## Testing

```bash
# Unit tests (Vitest) — pure functions, no network
npm run test:unit

# E2E tests (Playwright) — full browser flow
npx playwright install chromium   # first time only
npm run test:e2e

# All tests
npm run test:all
```

**Coverage:**

| Category | Tests |
|----------|-------|
| `computeDiff` — identical, added, removed, modified, multi-line, edge cases | 9 unit tests |
| Home page — loads, create session → host redirect | 2 E2E tests |
| Host page — Monaco editor, session badge, connection, viewer count | 4 E2E tests |
| Viewer page — loads, connects, read-only editor, Q&A, viewer name | 5 E2E tests |

---

## Deployment

### Frontend → Vercel

```bash
vercel --prod
```

Set env vars in Vercel Dashboard:
- `NEXT_PUBLIC_SOCKET_URL` → your Railway server URL
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`

### Server → Railway

1. Connect `server/` directory to a new Railway project
2. Set env vars: `FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GROQ_API_KEY`, `PORT=3001`
3. Deploy — Railway auto-detects Node.js via `railway.toml`

### GitHub Actions

The CI/CD pipeline runs automatically on push:

```
push to main
    ↓
├── Unit Tests (Vitest)
├── TypeScript check
├── ESLint
├── Next.js build
└── E2E Tests (Playwright)
```

Add GitHub Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`

---

## Project Structure

```
codecast/
├── app/
│   ├── page.tsx                  # Home — create/join session
│   ├── host/[sessionId]/page.tsx  # Host — Monaco editor + AI sidebar
│   ├── s/[sessionId]/page.tsx     # Viewer — read-only + Q&A
│   ├── api/annotate/route.ts      # POST: code diff → Groq → annotation
│   └── api/qa/route.ts            # POST: question + code → Groq → answer
├── components/
│   ├── CodeEditor.tsx             # Monaco editor (host, read/write)
│   ├── CodeViewer.tsx             # Monaco editor (viewer, read-only)
│   ├── AnnotationPanel.tsx        # AI annotation cards
│   └── QAPanel.tsx                # Q&A feed + input
├── hooks/
│   ├── useSocket.ts               # Socket.io connection hook
│   ├── useAIAnnotation.ts         # 2s debounce → /api/annotate
│   └── useViewerName.ts           # Stable random name in localStorage
├── lib/
│   ├── annotate.ts                # computeDiff + annotateCode (Groq)
│   └── supabase.ts                # Supabase client
├── server/
│   └── src/index.ts               # Express + Socket.io server
├── __tests__/
│   └── annotate.test.ts           # Vitest unit tests
├── e2e/
│   └── session.spec.ts            # Playwright E2E tests
└── .github/workflows/ci.yml       # GitHub Actions CI
```

---

## Roadmap

- [x] **W1** — Monaco Editor + Socket.io real-time sync
- [x] **W2** — Groq AI annotations (2s debounce, auto-explain)
- [x] **W3** — Viewer Q&A + Supabase session persistence
- [x] **W4** — Testing (Vitest + Playwright) + CI/CD + Deploy config
- [ ] **W5** — Session replay (watch recorded sessions)
- [ ] **W6** — Multi-language syntax-aware diffs
- [ ] **W7** — Auth (Supabase Auth), named sessions, host profiles

---

## License

MIT © 2026
