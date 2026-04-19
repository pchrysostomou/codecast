# </> CodeCast

> **Real-time live coding platform with AI annotations, session replay, and multi-language execution.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-codecast--eta.vercel.app-6366f1?style=for-the-badge&logo=vercel)](https://codecast-eta.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?style=for-the-badge&logo=socket.io)](https://socket.io)
[![Railway](https://img.shields.io/badge/Railway-deployed-0B0D0E?style=for-the-badge&logo=railway)](https://railway.app)

---

## What is CodeCast?

CodeCast is a **live coding broadcast platform** — think Twitch for coding interviews and live teaching sessions. Start a session, share a link, and viewers watch your every keystroke in real time through a Monaco editor. As you code, Groq's Llama 3.3 AI annotates your code automatically.

---

## ✨ Features

| Feature | Description |
|---|---|
| ⚡ **Real-Time Sync** | Every keystroke broadcast to all viewers instantly via Socket.io WebSockets |
| 🤖 **AI Annotations** | Groq Llama 3.3 analyzes code as you type, surfaces context-aware insights |
| ⏮ **Session Replay** | Full keystroke-by-keystroke playback stored in Supabase — rewatch any session |
| ▶ **Code Execution** | Run JavaScript & TypeScript (server-side vm), Python (Pyodide WASM in-browser) |
| 💬 **Live Q&A** | Viewers ask questions; AI answers them in real time, synced to all watchers |
| 🔥 **Emoji Reactions** | Thumbs-up, fire, lightbulb — reactions float over the editor live |
| 🔗 **Instant Sharing** | One shareable link — no sign-up required for viewers |
| 🌙 **Monaco Editor** | VS Code's editor with syntax highlighting, ligatures, and 10+ languages |

---

## 🚀 Live Demo

**[https://codecast-eta.vercel.app](https://codecast-eta.vercel.app)**

1. Click **Start a session** — get a shareable link instantly  
2. Open the link in another tab — watch yourself code live  
3. Select Python → type `print("Hello!")` → press **Run** → see output  
4. Ask a question in Q&A tab — AI answers it  
5. Click **Watch Replay** after coding — replay keystroke by keystroke  

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Host)                        │
│  Next.js 15 · Monaco Editor · Pyodide WASM (Python)     │
│                         │                               │
│                  Socket.io WebSocket                     │
└──────────────────────────┬──────────────────────────────┘
                           │
         ┌─────────────────┴──────────────────┐
         │                                    │
┌────────▼────────┐                 ┌─────────▼────────┐
│  Vercel (Edge)  │                 │  Railway (Persistent) │
│  Next.js App    │                 │  Express + Socket.io  │
│  /api/run       │                 │  AI annotations       │
│  (JS/TS via vm) │                 │  Session persistence  │
└────────┬────────┘                 └─────────┬────────┘
         │                                    │
         │                          ┌─────────▼────────┐
         │                          │  Supabase (Postgres) │
         │                          │  Sessions · Snapshots│
         │                          │  Q&A messages        │
         │                          └──────────────────────┘
         │
┌────────▼────────────────────────────┐
│  Groq API (Llama 3.3 70B Versatile) │
│  Real-time code annotations         │
│  Live Q&A answering                 │
└─────────────────────────────────────┘
```

### Code Execution Engine

| Language | Engine | Where |
|---|---|---|
| JavaScript | Node.js `vm` sandbox | Vercel serverless |
| TypeScript | `tsc` transpile → `vm` | Vercel serverless |
| Python | **Pyodide WASM** (CPython 3.11) | Browser (client-side) |
| Java / Go / C / Rust | Coming soon | — |

---

## 🛠 Tech Stack

### Frontend
- **Next.js 15** (App Router) — Server & client components
- **TypeScript** — End-to-end type safety  
- **Monaco Editor** (`@monaco-editor/react`) — VS Code editor in the browser
- **Pyodide v0.25** — CPython 3.11 compiled to WebAssembly for in-browser Python execution
- **Socket.io Client** — Real-time WebSocket communication

### Backend
- **Express.js** + **Socket.io** — Persistent WebSocket server (Railway)
- **Groq SDK** (Llama 3.3 70B) — AI code annotations & Q&A
- **Supabase** (PostgreSQL) — Session storage, snapshots, Q&A persistence

### Infrastructure
- **Vercel** — Frontend + serverless API routes
- **Railway** — Persistent Node.js Socket.io server (no cold starts)
- **GitHub Actions** — CI/CD (ESLint, TypeScript, Unit Tests, E2E, Build)

---

## 📁 Project Structure

```
codecast/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── host/[sessionId]/        # Host coding session
│   ├── s/[sessionId]/           # Viewer page (read-only)
│   ├── replay/[sessionId]/      # Session replay player
│   └── api/run/route.ts         # Code execution API (JS/TS)
├── components/
│   ├── CodeEditor.tsx           # Monaco editor with Socket.io sync
│   ├── RunPanel.tsx             # Code execution terminal (Pyodide)
│   ├── AnnotationPanel.tsx      # AI code annotations (Groq)
│   ├── QAPanel.tsx              # Live Q&A with AI answers
│   ├── ReplayPlayer.tsx         # Keystroke-by-keystroke replay
│   └── CodeViewer.tsx           # Read-only viewer component
├── server/
│   └── src/index.ts             # Express + Socket.io server (Railway)
├── supabase/migrations/         # Database schema
├── e2e/                         # Playwright E2E tests
└── __tests__/                   # Jest unit tests
```

---

## 🔌 Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `session:join` | Client → Server | Join as host or viewer |
| `code:change` | Host → Server → Viewers | Live code sync |
| `code:run` | Host → Server → Viewers | Broadcast execution result |
| `language:change` | Host → Server → Viewers | Language selection sync |
| `annotation:update` | Server → All | AI annotation broadcast |
| `qa:question` | Viewer → Server | Ask a question |
| `qa:answer` | Server → All | AI answer broadcast |
| `reaction:send` | Viewer → Server → All | Emoji reaction |

---

## 🚦 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account (free tier works)
- Groq API key (free at [console.groq.com](https://console.groq.com))

### Local Development

```bash
# Clone
git clone https://github.com/pchrysostomou/codecast.git
cd codecast

# Install dependencies
npm install
cd server && npm install && cd ..

# Environment variables
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SOCKET_URL, SUPABASE_URL, SUPABASE_ANON_KEY, GROQ_API_KEY

# Start the Socket.io server (terminal 1)
cd server && npm run dev

# Start Next.js (terminal 2)
npm run dev
```

Visit `http://localhost:3000`

### Environment Variables

**Next.js (`.env.local`)**:
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Railway server**:
```env
FRONTEND_URL=https://your-vercel-app.vercel.app
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
GROQ_API_KEY=gsk_...
```

---

## 📊 Database Schema

```sql
-- Sessions
create table sessions (
  id text primary key,
  language text default 'typescript',
  created_at timestamptz default now(),
  ended_at timestamptz,
  final_code text
);

-- Snapshots (for replay)
create table snapshots (
  id uuid default gen_random_uuid() primary key,
  session_id text references sessions(id),
  code text,
  ts timestamptz default now()
);

-- Q&A messages
create table qa_messages (
  id uuid default gen_random_uuid() primary key,
  session_id text references sessions(id),
  question text,
  answer text,
  created_at timestamptz default now()
);
```

---

## 🧪 Testing

```bash
# Unit tests
npm test

# TypeScript check
npx tsc --noEmit

# ESLint
npm run lint

# E2E tests (requires running server)
npx playwright test
```

CI runs all checks automatically on every push via GitHub Actions.

---

## 🚢 Deployment

### Vercel (Frontend)
1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy — automatic on every push to `main`

### Railway (Socket.io Server)
1. Create Railway project, link `server/` directory
2. Add environment variables
3. Railway auto-deploys from `server/railway.toml`

> ⚠️ **Important**: Do not add a `healthcheckPath` to `railway.toml`. Railway uses TCP health checks for long-lived Socket.io servers.

---

## 📄 License

MIT — do whatever you want with this.

---

<p align="center">
  Built by <a href="https://github.com/pchrysostomou">@pchrysostomou</a> · 
  <a href="https://codecast-eta.vercel.app">Live Demo</a>
</p>
