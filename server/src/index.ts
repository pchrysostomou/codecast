import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'
import { saveSnapshot } from './snapshots.js'

// ── Load env ─────────────────────────────────────────────────
// tsx loads .env automatically in dev; in prod set via Railway
const FRONTEND_URL  = process.env.FRONTEND_URL  || 'http://localhost:3002'
const SUPABASE_URL  = process.env.SUPABASE_URL  || ''
const SUPABASE_KEY  = process.env.SUPABASE_ANON_KEY || ''
const GROQ_KEY      = process.env.GROQ_API_KEY  || ''

// Allow any Vercel preview URL + explicit FRONTEND_URL + localhost
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  if (origin === FRONTEND_URL) return true
  if (origin.endsWith('.vercel.app')) return true
  if (origin.startsWith('http://localhost')) return true
  return false
}

// ── Supabase ─────────────────────────────────────────────────
const db = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

async function dbCreateSession(sessionId: string, language: string) {
  if (!db) { console.warn('[db] No Supabase client — skipping session persist'); return }
  const { error } = await db.from('codecast_sessions').upsert({
    id: sessionId,
    language,
    created_at: new Date().toISOString(),
    ended_at: null,
    code_snapshot: null,
  }, { onConflict: 'id' })
  if (error) console.error('[db] dbCreateSession error:', error.message, error.details)
  else console.log(`[db] session persisted: ${sessionId}`)
}

async function dbEndSession(sessionId: string, codeSnapshot: string) {
  if (!db) return
  await db.from('codecast_sessions').update({
    ended_at: new Date().toISOString(),
    code_snapshot: codeSnapshot,
  }).eq('id', sessionId)
}

async function dbSaveQuestion(
  sessionId: string,
  viewerName: string,
  question: string,
  answer: string
) {
  if (!db) return
  await db.from('codecast_questions').insert({
    session_id: sessionId,
    viewer_name: viewerName,
    question,
    answer,
    asked_at: new Date().toISOString(),
  })
}

// ── Groq ─────────────────────────────────────────────────────
const groq = GROQ_KEY ? new Groq({ apiKey: GROQ_KEY }) : null

async function answerQuestion(
  question: string,
  code: string,
  language: string,
  viewerName: string
): Promise<string> {
  if (!groq) return 'AI not configured.'

  const codeContext = code.trim()
    ? `Current code:\n\`\`\`${language}\n${code.slice(0, 3000)}\n\`\`\``
    : 'No code written yet.'

  const res = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a helpful coding instructor answering viewer questions during a live coding session.
Be concise (3-4 sentences max), practical, and educational. Focus on explaining WHY.`,
      },
      {
        role: 'user',
        content: `${codeContext}\n\nQuestion from ${viewerName}: "${question}"`,
      },
    ],
    max_tokens: 300,
    temperature: 0.5,
  })

  return res.choices[0].message.content ?? 'Could not generate an answer.'
}

// ── Express + Socket.io ───────────────────────────────────────
const app = express()
app.use(cors({ origin: isAllowedOrigin, credentials: true }))

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: isAllowedOrigin, methods: ['GET', 'POST'], credentials: true },
})

// ── In-memory state ───────────────────────────────────────────
const sessionCode     = new Map<string, string>()          // sessionId → code
const sessionLanguage = new Map<string, string>()          // sessionId → language
const hostSockets     = new Map<string, string>()          // sessionId → host socket.id
const sessionViewers  = new Map<string, Set<string>>()     // sessionId → viewer socket ids
const snapshotTimers  = new Map<string, ReturnType<typeof setTimeout>>()

function getViewerCount(sessionId: string) {
  return sessionViewers.get(sessionId)?.size ?? 0
}

function broadcastViewerCount(sessionId: string) {
  io.to(sessionId).emit('viewers:update', { count: getViewerCount(sessionId) })
}

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessionCode.size, db: !!db, ai: !!groq })
})

// ── Socket events ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`)

  // ── session:join ────────────────────────────────────────────
  socket.on(
    'session:join',
    ({ sessionId, role, language = 'typescript' }: {
      sessionId: string
      role: 'host' | 'viewer'
      language?: string
    }) => {
      socket.join(sessionId)
      console.log(`[join] ${role} ${socket.id} → ${sessionId}`)

      if (role === 'host') {
        hostSockets.set(sessionId, socket.id)
        if (!sessionCode.has(sessionId)) sessionCode.set(sessionId, '')
        sessionLanguage.set(sessionId, language)
        // Persist session to Supabase
        dbCreateSession(sessionId, language).catch(console.error)
      } else {
        if (!sessionViewers.has(sessionId)) sessionViewers.set(sessionId, new Set())
        sessionViewers.get(sessionId)!.add(socket.id)
        // Send current state to new viewer
        socket.emit('code:sync', { code: sessionCode.get(sessionId) ?? '' })
        broadcastViewerCount(sessionId)
      }
    }
  )

  // ── code:change ─────────────────────────────────────────────
  socket.on(
    'code:change',
    ({ sessionId, code }: { sessionId: string; code: string }) => {
      sessionCode.set(sessionId, code)
      socket.to(sessionId).emit('code:update', { code })

      // Throttled snapshot: save to Supabase at most once per 5s per session
      if (snapshotTimers.has(sessionId)) clearTimeout(snapshotTimers.get(sessionId)!)
      snapshotTimers.set(sessionId, setTimeout(() => {
        const lang = sessionLanguage.get(sessionId) ?? 'typescript'
        saveSnapshot(sessionId, code, lang).catch(console.error)
        snapshotTimers.delete(sessionId)
      }, 5000))
    }
  )

  // ── annotation:new ──────────────────────────────────────────
  socket.on(
    'annotation:new',
    ({ sessionId, annotation }: { sessionId: string; annotation: unknown }) => {
      io.to(sessionId).emit('annotation:received', { annotation })
    }
  )

  // ── question:ask ─────────────────────────────────────────────
  socket.on(
    'question:ask',
    async ({
      sessionId,
      question,
      viewerName = 'guest',
      code,
      language,
    }: {
      sessionId: string
      question: string
      viewerName?: string
      code?: string
      language?: string
    }) => {
      const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const currentCode = code ?? sessionCode.get(sessionId) ?? ''
      const lang = language ?? sessionLanguage.get(sessionId) ?? 'typescript'

      // Broadcast the question immediately (answer = null = "thinking")
      io.to(sessionId).emit('question:asked', {
        id: entryId,
        sessionId,
        viewerName,
        question,
        answer: null,
        askedAt: Date.now(),
      })

      console.log(`[Q&A] ${viewerName}: "${question}"`)

      try {
        const answer = await answerQuestion(question, currentCode, lang, viewerName)

        // Broadcast the answer
        io.to(sessionId).emit('question:answered', {
          id: entryId,
          sessionId,
          viewerName,
          question,
          answer,
          askedAt: Date.now(),
        })

        // Persist to Supabase
        dbSaveQuestion(sessionId, viewerName, question, answer).catch(console.error)
      } catch (err) {
        console.error('[Q&A error]', err)
        io.to(sessionId).emit('question:answered', {
          id: entryId,
          sessionId,
          viewerName,
          question,
          answer: 'Sorry, could not generate an answer. Please try again.',
          askedAt: Date.now(),
        })
      }
    }
  )

  // ── reaction:send (viewer sends emoji → relay to all in room) ─
  socket.on('reaction:send', ({ sessionId, emoji }: { sessionId: string; emoji: string }) => {
    // Relay to EVERYONE in the session (including sender's other windows)
    io.to(sessionId).emit('reaction:broadcast', { emoji, from: socket.id })
    console.log(`[reaction] ${socket.id} → ${sessionId}: ${emoji}`)
  })

  // ── code:run  (host runs code → broadcast result to viewers) ─
  socket.on('code:run', ({ sessionId, result }: {
    sessionId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any
  }) => {
    console.log(`[run] ${socket.id} → session ${sessionId} exit=${result?.exitCode}`)
    // Relay to all OTHER sockets in the room (viewers)
    socket.to(sessionId).emit('code:run:result', result)
  })

  // ── disconnect ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`)

    sessionViewers.forEach((viewers, sessionId) => {
      if (viewers.has(socket.id)) {
        viewers.delete(socket.id)
        broadcastViewerCount(sessionId)
      }
    })

    hostSockets.forEach((hostId, sessionId) => {
      if (hostId === socket.id) {
        hostSockets.delete(sessionId)
        io.to(sessionId).emit('host:disconnected')
        // Mark session ended in Supabase
        const code = sessionCode.get(sessionId) ?? ''
        dbEndSession(sessionId, code).catch(console.error)
      }
    })
  })
})

// ── Start ─────────────────────────────────────────────────────
// Listen on 0.0.0.0 so Railway's reverse proxy can reach the container
const PORT = Number(process.env.PORT) || 3001
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CodeCast server on port ${PORT} | DB: ${db ? '✅' : '❌'} | AI: ${groq ? '✅' : '❌'}`)
})
