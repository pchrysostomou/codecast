'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateSessionId } from '@/lib/generateId'

const FEATURES = [
  {
    icon: '⚡',
    title: 'Real-Time Live Coding',
    desc: 'Every keystroke synced to all viewers instantly via Socket.io WebSockets. Zero lag, zero setup.',
    color: '#60a5fa',
  },
  {
    icon: '🤖',
    title: 'AI Code Annotations',
    desc: 'Groq Llama 3.3 analyzes your code as you type and surfaces intelligent, context-aware insights.',
    color: '#a78bfa',
  },
  {
    icon: '⏮',
    title: 'Session Replay',
    desc: 'Every session captured to Supabase. Replay any coding session keystroke-by-keystroke like a video.',
    color: '#34d399',
  },
  {
    icon: '▶',
    title: 'Run Code Live',
    desc: 'Execute JavaScript, TypeScript & Python right in the browser. Viewers see the output in real-time.',
    color: '#fb923c',
  },
  {
    icon: '💬',
    title: 'Live Q&A',
    desc: 'Viewers ask questions, get AI-powered answers, all synced live. Perfect for teaching sessions.',
    color: '#f472b6',
  },
  {
    icon: '🔥',
    title: 'Emoji Reactions',
    desc: 'Viewers send thumbs-up, fire, and more. Reactions float over the editor in real time.',
    color: '#fbbf24',
  },
]

const CODE_LINES = [
  { text: 'async function fetchUser(id: string) {', indent: 0 },
  { text: '  const res = await fetch(`/api/users/${id}`)', indent: 0 },
  { text: '  if (!res.ok) throw new Error("Not found")', indent: 0 },
  { text: '  return res.json()', indent: 0 },
  { text: '}', indent: 0 },
  { text: '', indent: 0 },
  { text: '// 🤖 AI: Consider adding retry logic', indent: 0, comment: true },
  { text: '// 🤖 AI: Handle network timeouts', indent: 0, comment: true },
]

function AnimatedCode() {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(v => (v < CODE_LINES.length ? v + 1 : v))
    }, 320)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="lp-code-block">
      <div className="lp-code-topbar">
        <span className="lp-dot lp-dot--red" />
        <span className="lp-dot lp-dot--yellow" />
        <span className="lp-dot lp-dot--green" />
        <span className="lp-code-filename">session.ts</span>
        <span className="lp-live-badge">● LIVE</span>
      </div>
      <div className="lp-code-body">
        {CODE_LINES.slice(0, visible).map((line, i) => (
          <div key={i} className={`lp-code-line${line.comment ? ' lp-code-line--comment' : ''}`}>
            <span className="lp-line-num">{i + 1}</span>
            <span>{line.text || '\u00a0'}</span>
            {i === visible - 1 && <span className="lp-cursor">|</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [joinId, setJoinId] = useState('')
  const [creating, setCreating] = useState(false)

  function handleCreate() {
    setCreating(true)
    router.push(`/host/${generateSessionId()}`)
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = joinId.trim()
    if (trimmed) router.push(`/s/${trimmed}`)
  }

  return (
    <main className="lp-root">
      {/* ── Animated mesh background ─────────────── */}
      <div className="lp-bg" aria-hidden>
        <div className="lp-orb lp-orb--1" />
        <div className="lp-orb lp-orb--2" />
        <div className="lp-orb lp-orb--3" />
        <div className="lp-grid" />
      </div>

      {/* ── Nav ──────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav__brand">
          <span className="lp-nav__mark">{'</>'}</span>
          <span className="lp-nav__name">CodeCast</span>
        </div>
        <div className="lp-nav__links">
          <a href="https://github.com/pchrysostomou/codecast" target="_blank" rel="noreferrer" className="lp-nav__link">
            GitHub ↗
          </a>
          <button className="lp-nav__cta" onClick={handleCreate} disabled={creating}>
            {creating ? 'Starting…' : 'Start coding →'}
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero__badge">
          <span className="lp-pulse" />
          Live · AI-Powered · Open Source
        </div>

        <h1 className="lp-hero__title">
          Live coding sessions<br />
          <span className="lp-hero__gradient">powered by AI</span>
        </h1>

        <p className="lp-hero__sub">
          Share your editor in real-time. Viewers follow every keystroke, ask questions, and react live.<br />
          Groq AI annotates your code as you type. Every session is replayable.
        </p>

        <div className="lp-hero__actions">
          <button
            id="start-coding-btn"
            className="lp-btn lp-btn--primary"
            onClick={handleCreate}
            disabled={creating}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {creating ? 'Creating session…' : 'Start a session'}
          </button>

          <form onSubmit={handleJoin} className="lp-join-form">
            <input
              className="lp-join-input"
              type="text"
              placeholder="Session ID to watch…"
              value={joinId}
              onChange={e => setJoinId(e.target.value)}
              spellCheck={false}
              aria-label="Session ID"
            />
            <button type="submit" className="lp-btn lp-btn--ghost">
              Watch →
            </button>
          </form>
        </div>

        <div className="lp-hero__demo">
          <AnimatedCode />

          <div className="lp-viewers">
            <div className="lp-viewers__head">
              <span className="lp-online-dot" />
              3 watching
            </div>
            <div className="lp-viewer-avatars">
              {['A', 'B', 'C'].map(l => (
                <div key={l} className="lp-avatar">{l}</div>
              ))}
            </div>
            <div className="lp-reaction-stream">
              <span>🔥</span><span>👍</span><span>💡</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────── */}
      <section className="lp-features">
        <div className="lp-section-label">FEATURES</div>
        <h2 className="lp-section-title">Everything you need to teach code live</h2>

        <div className="lp-feature-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="lp-feature-card" style={{ '--accent-color': f.color } as React.CSSProperties}>
              <div className="lp-feature-icon">{f.icon}</div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────── */}
      <section className="lp-stack">
        <div className="lp-section-label">BUILT WITH</div>
        <div className="lp-stack-pills">
          {['Next.js 15', 'TypeScript', 'Socket.io', 'Monaco Editor', 'Groq Llama 3.3', 'Supabase', 'Pyodide', 'Railway', 'Vercel'].map(t => (
            <span key={t} className="lp-stack-pill">{t}</span>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer__brand">
          <span className="lp-nav__mark">{'</>'}</span>
          <span>CodeCast</span>
        </div>
        <p className="lp-footer__copy">
          Built for portfolio · Open Source ·{' '}
          <a href="https://github.com/pchrysostomou/codecast" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </p>
      </footer>
    </main>
  )
}
