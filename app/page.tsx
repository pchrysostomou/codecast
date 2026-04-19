'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateSessionId } from '@/lib/generateId'

export default function HomePage() {
  const router = useRouter()
  const [joinId, setJoinId] = useState('')
  const [creating, setCreating] = useState(false)

  function handleCreate() {
    setCreating(true)
    const id = generateSessionId()
    router.push(`/host/${id}`)
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = joinId.trim()
    if (!trimmed) return
    router.push(`/s/${trimmed}`)
  }

  return (
    <main className="home-page">
      {/* Logo */}
      <div className="home-logo">
        <span className="logo-mark">{'</>'}</span>
        <span className="logo-text">CodeCast</span>
      </div>

      <p className="home-tagline">
        Live coding sessions with AI annotations.
        <br />
        You write code — viewers see every keystroke, live.
      </p>

      {/* Actions */}
      <div className="home-actions">
        {/* Create session */}
        <div className="action-card action-card--primary">
          <div className="action-card__icon">🎬</div>
          <h2 className="action-card__title">Start a Session</h2>
          <p className="action-card__desc">
            Open the editor and get a shareable link instantly.
          </p>
          <button
            className="btn btn--primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Start coding →'}
          </button>
        </div>

        {/* Join session */}
        <div className="action-card">
          <div className="action-card__icon">👁️</div>
          <h2 className="action-card__title">Watch a Session</h2>
          <p className="action-card__desc">
            Enter a session ID to watch in real-time, read-only.
          </p>
          <form onSubmit={handleJoin} className="join-form">
            <input
              className="join-input"
              type="text"
              placeholder="Session ID..."
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              spellCheck={false}
            />
            <button type="submit" className="btn btn--secondary">
              Join →
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="home-footer">
        <span>Next.js · Monaco · Socket.io · Groq</span>
      </footer>
    </main>
  )
}
