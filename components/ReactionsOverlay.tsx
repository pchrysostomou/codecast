'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Socket } from 'socket.io-client'

export type ReactionEmoji = '👍' | '🔥' | '💡' | '❓' | '👏' | '😮'

export const REACTIONS: { emoji: ReactionEmoji; label: string }[] = [
  { emoji: '👍', label: 'Nice' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💡', label: 'Idea' },
  { emoji: '❓', label: 'Question' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '😮', label: 'Wow' },
]

interface FloatingReaction {
  id: string
  emoji: ReactionEmoji
  x: number        // % from left
  startTime: number
}

interface ReactionsOverlayProps {
  socket: Socket | null
  sessionId: string
  role: 'host' | 'viewer'
}

const LIFETIME_MS = 2800

export function ReactionsOverlay({ socket, sessionId, role }: ReactionsOverlayProps) {
  const [reactions, setReactions] = useState<FloatingReaction[]>([])
  const [counts, setCounts] = useState<Record<ReactionEmoji, number>>({} as Record<ReactionEmoji, number>)
  const containerRef = useRef<HTMLDivElement>(null)

  // Listen for incoming reactions
  useEffect(() => {
    if (!socket) return

    function onReaction(data: { emoji: ReactionEmoji }) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const x = 10 + Math.random() * 80  // 10–90% horizontal

      setReactions(prev => [...prev, { id, emoji: data.emoji, x, startTime: Date.now() }])

      // Track counts (for host badge)
      setCounts(prev => ({ ...prev, [data.emoji]: (prev[data.emoji] ?? 0) + 1 }))

      // Remove after animation ends
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id))
      }, LIFETIME_MS + 200)
    }

    socket.on('reaction:broadcast', onReaction)
    return () => { socket.off('reaction:broadcast', onReaction) }
  }, [socket])

  // ── Viewer: send a reaction ──────────────────────────────────
  const sendReaction = useCallback((emoji: ReactionEmoji) => {
    socket?.emit('reaction:send', { sessionId, emoji })
    // Show locally immediately
    const id = `local-${crypto.randomUUID()}`
    const x = 10 + Math.random() * 80
    setReactions(prev => [...prev, { id, emoji, x, startTime: Date.now() }])
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), LIFETIME_MS + 200)
  }, [socket, sessionId])

  return (
    <>
      {/* Floating overlay — covers the whole editor area */}
      <div ref={containerRef} className="reactions-overlay" aria-hidden="true">
        {reactions.map(r => (
          <span
            key={r.id}
            className="reaction-float"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Reaction bar — viewer sends, host sees count badges */}
      <div className="reaction-bar">
        {REACTIONS.map(({ emoji, label }) => (
          <button
            key={emoji}
            className="reaction-btn"
            onClick={role === 'viewer' ? () => sendReaction(emoji) : undefined}
            disabled={role === 'host'}
            title={label}
            aria-label={`${label} reaction`}
          >
            <span className="reaction-btn__emoji">{emoji}</span>
            {role === 'host' && (counts[emoji] ?? 0) > 0 && (
              <span className="reaction-btn__count">{counts[emoji]}</span>
            )}
          </button>
        ))}
        {role === 'host' && (
          <span className="reaction-bar__label">Viewer reactions</span>
        )}
      </div>
    </>
  )
}
