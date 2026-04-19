'use client'

import { useState, useRef, useCallback } from 'react'
import type { Socket } from 'socket.io-client'

export interface QAEntry {
  id: string
  viewerName: string
  question: string
  answer: string | null   // null while pending
  askedAt: number
}

interface QAPanelProps {
  sessionId: string
  currentCode: string
  language: string
  socket: Socket | null
  entries: QAEntry[]
  viewerName: string
  role: 'host' | 'viewer'
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5)  return 'just now'
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ago`
}

export function QAPanel({ sessionId, currentCode, language, socket, entries, viewerName, role }: QAPanelProps) {
  const [questionText, setQuestionText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const q = questionText.trim()
    if (!q || sending || !socket) return

    setSending(true)
    setQuestionText('')

    // Emit to socket — server handles Groq + broadcast
    socket.emit('question:ask', {
      sessionId,
      question: q,
      viewerName,
      code: currentCode,
      language,
    })

    setSending(false)
    inputRef.current?.focus()
  }, [questionText, sending, socket, sessionId, viewerName, currentCode, language])

  return (
    <div className="qa-panel">
      {/* Header */}
      <div className="qa-header">
        <span className="qa-header__title">💬 Q&amp;A</span>
        <span className="qa-header__count">{entries.length}</span>
      </div>

      {/* Feed */}
      <div className="qa-feed">
        {entries.length === 0 && (
          <div className="qa-empty">
            {role === 'viewer'
              ? 'Ask a question about the code!'
              : 'Viewer questions will appear here.'}
          </div>
        )}

        {[...entries].reverse().map((entry) => (
          <div key={entry.id} className="qa-entry">
            {/* Question */}
            <div className="qa-entry__question">
              <span className="qa-entry__name">{entry.viewerName}</span>
              <span className="qa-entry__time">{timeAgo(entry.askedAt)}</span>
              <p className="qa-entry__text">{entry.question}</p>
            </div>

            {/* Answer */}
            {entry.answer === null ? (
              <div className="qa-entry__thinking">
                <span className="qa-thinking-dot" />
                <span className="qa-thinking-dot" />
                <span className="qa-thinking-dot" />
              </div>
            ) : (
              <div className="qa-entry__answer">
                <span className="qa-entry__bot-label">🤖 AI</span>
                <p className="qa-entry__answer-text">{entry.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input — only for viewers */}
      {role === 'viewer' && (
        <form className="qa-input-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="qa-input"
            type="text"
            placeholder="Ask about the code..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            disabled={sending}
            maxLength={300}
          />
          <button
            type="submit"
            className="qa-send-btn"
            disabled={!questionText.trim() || sending}
            aria-label="Send question"
          >
            <SendIcon />
          </button>
        </form>
      )}
    </div>
  )
}
