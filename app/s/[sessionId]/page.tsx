'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CodeViewer } from '@/components/CodeViewer'
import { AnnotationPanel } from '@/components/AnnotationPanel'
import { QAPanel, type QAEntry } from '@/components/QAPanel'
import { useSocket } from '@/hooks/useSocket'
import { useViewerName } from '@/hooks/useViewerName'
import type { Annotation } from '@/lib/annotate'

export default function ViewerPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const { socket, socketRef, isConnected, viewerCount } = useSocket()
  const viewerName = useViewerName()

  const [code, setCode] = useState('')
  const [language] = useState('typescript')
  const [hostOnline, setHostOnline] = useState(true)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [qaEntries, setQaEntries] = useState<QAEntry[]>([])
  const [activeTab, setActiveTab] = useState<'ai' | 'qa'>('ai')
  const hasJoined = useRef(false)

  useEffect(() => {
    const sock = socketRef.current
    if (!sock || !isConnected || hasJoined.current) return
    hasJoined.current = true

    sock.emit('session:join', { sessionId, role: 'viewer', language })

    sock.on('code:sync', ({ code: c }: { code: string }) => setCode(c))

    sock.on('code:update', ({ code: c }: { code: string }) => {
      setCode(c)
      setIsAnalyzing(true)
      setTimeout(() => setIsAnalyzing(false), 3000)
    })

    sock.on('annotation:received', ({ annotation }: { annotation: Annotation }) => {
      setAnnotations((prev) => [...prev.slice(-19), annotation])
      setIsAnalyzing(false)
    })

    // Q&A: question immediately shown with answer=null ("thinking")
    sock.on('question:asked', (entry: QAEntry) => {
      setQaEntries((prev) => [...prev.slice(-49), entry])
      setActiveTab('qa')
    })

    // Q&A: answer fills in
    sock.on('question:answered', ({ id, answer }: { id: string; answer: string }) => {
      setQaEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, answer } : e))
      )
    })

    sock.on('host:disconnected', () => setHostOnline(false))

    return () => {
      sock.off('code:sync')
      sock.off('code:update')
      sock.off('annotation:received')
      sock.off('question:asked')
      sock.off('question:answered')
      sock.off('host:disconnected')
    }
  }, [isConnected, sessionId, socketRef, language])

  return (
    <div className="session-layout">
      <header className="session-topbar">
        <div className="session-topbar__left">
          <span className="logo-mark small">{'</>'}</span>
          <span className="logo-text small">CodeCast</span>
          <span className="session-id-badge">#{sessionId}</span>
        </div>
        <div className="session-topbar__right">
          <div className="viewer-pill">
            <span className={`status-dot ${isConnected ? 'status-dot--live' : 'status-dot--offline'}`} />
            <span>{viewerCount} watching</span>
          </div>
          <div className="viewer-name-badge">👤 {viewerName}</div>
          <div className={`conn-badge ${isConnected ? 'conn-badge--connected' : 'conn-badge--disconnected'}`}>
            {isConnected ? '● Watching live' : '○ Connecting...'}
          </div>
        </div>
      </header>

      {!hostOnline && (
        <div className="host-offline-banner">
          ⚠️ The host has disconnected. Session may have ended.
        </div>
      )}

      <div className="session-body">
        <CodeViewer code={code} language={language} isConnected={isConnected} />

        <aside className="session-sidebar">
          {/* Session info */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Watching</h3>
            <div className="sidebar-item">
              <span className="sidebar-label">Session</span>
              <code className="sidebar-value">{sessionId}</code>
            </div>
            <div className="sidebar-item">
              <span className="sidebar-label">Viewers</span>
              <span className="sidebar-value">{viewerCount}</span>
            </div>
            <div className="sidebar-item">
              <span className="sidebar-label">You</span>
              <span className="sidebar-value">{viewerName}</span>
            </div>
          </div>

          {/* Tab switcher: AI | Q&A */}
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'ai' ? 'sidebar-tab--active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              🤖 AI {annotations.length > 0 && <span className="tab-badge">{annotations.length}</span>}
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'qa' ? 'sidebar-tab--active' : ''}`}
              onClick={() => setActiveTab('qa')}
            >
              💬 Q&amp;A {qaEntries.length > 0 && <span className="tab-badge">{qaEntries.length}</span>}
            </button>
          </div>

          {/* Panel content */}
          {activeTab === 'ai' ? (
            <AnnotationPanel annotations={annotations} isAnalyzing={isAnalyzing} />
          ) : (
            <QAPanel
              sessionId={sessionId}
              currentCode={code}
              language={language}
              socket={socket}
              entries={qaEntries}
              viewerName={viewerName}
              role="viewer"
            />
          )}
        </aside>
      </div>
    </div>
  )
}
