'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ReplayPlayer, type Snapshot } from '@/components/ReplayPlayer'

interface ReplayData {
  session: {
    id: string
    language: string
    created_at: string
    ended_at: string | null
    code_snapshot: string | null
  }
  snapshots: Snapshot[]
  totalSnapshots: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ReplayPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [data, setData] = useState<ReplayData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/replay`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? 'Not found')
        return res.json() as Promise<ReplayData>
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  return (
    <div className="replay-layout">
      {/* Top bar */}
      <header className="session-topbar">
        <div className="session-topbar__left">
          <span className="logo-mark small">{'</>'}</span>
          <span className="logo-text small">CodeCast</span>
          <span className="replay-badge">⏮ Replay</span>
          {data && <span className="session-id-badge">#{sessionId}</span>}
        </div>
        {data && (
          <div className="session-topbar__right">
            <span className="replay-meta">
              📅 {formatDate(data.session.created_at)}
            </span>
            <span className="replay-meta">
              📸 {data.totalSnapshots} snapshots
            </span>
            <Link href={`/s/${sessionId}`} className="btn btn--ghost btn--sm">
              Watch live →
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="replay-content">
        {loading && (
          <div className="replay-loading">
            <div className="replay-spinner" />
            <p>Loading replay...</p>
          </div>
        )}

        {error && (
          <div className="replay-error">
            <span className="replay-error__icon">⚠️</span>
            <h2>Session not found</h2>
            <p>{error}</p>
            <Link href="/" className="btn btn--primary">Go home</Link>
          </div>
        )}

        {!loading && !error && data && (
          <ReplayPlayer
            snapshots={data.snapshots}
            language={data.session.language ?? 'typescript'}
          />
        )}
      </div>
    </div>
  )
}
