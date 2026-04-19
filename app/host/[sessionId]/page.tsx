'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CodeEditor } from '@/components/CodeEditor'
import { AnnotationPanel } from '@/components/AnnotationPanel'
import { QAPanel, type QAEntry } from '@/components/QAPanel'
import { useSocket } from '@/hooks/useSocket'
import { useAIAnnotation } from '@/hooks/useAIAnnotation'
import type { Annotation } from '@/lib/annotate'

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

export default function HostPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const { socket, socketRef, isConnected, viewerCount } = useSocket()
  const { scheduleAnnotation } = useAIAnnotation(sessionId, socketRef)

  const [language, setLanguage] = useState('typescript')
  const [copied, setCopied] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [qaEntries, setQaEntries] = useState<QAEntry[]>([])
  const [activeTab, setActiveTab] = useState<'ai' | 'qa'>('ai')
  const hasJoined = useRef(false)
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeRef = useRef<string>('')
  const languageRef = useRef<string>('typescript')

  const viewerUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/s/${sessionId}`
      : `/s/${sessionId}`

  // Join session as host when socket connects + persist to Supabase
  useEffect(() => {
    const sock = socketRef.current
    if (!sock || !isConnected || hasJoined.current) return
    hasJoined.current = true
    sock.emit('session:join', { sessionId, role: 'host', language })
    // Persist session via Next.js API (has Supabase network access)
    fetch('/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, language }),
    }).catch(console.error)
  }, [isConnected, sessionId, socketRef, language])

  // Listen for annotation:received + Q&A events
  useEffect(() => {
    const sock = socketRef.current
    if (!sock) return

    const onAnnotation = ({ annotation }: { annotation: Annotation }) => {
      setAnnotations((prev) => [...prev.slice(-19), annotation])
      setIsAnalyzing(false)
    }
    const onQAsked = (entry: QAEntry) => {
      setQaEntries((prev) => [...prev.slice(-49), entry])
      setActiveTab('qa')
    }
    const onQAnswered = ({ id, answer }: { id: string; answer: string }) => {
      setQaEntries((prev) => prev.map((e) => (e.id === id ? { ...e, answer } : e)))
    }

    sock.on('annotation:received', onAnnotation)
    sock.on('question:asked',    onQAsked)
    sock.on('question:answered', onQAnswered)

    return () => {
      sock.off('annotation:received', onAnnotation)
      sock.off('question:asked',    onQAsked)
      sock.off('question:answered', onQAnswered)
    }
  }, [socketRef])

  // Called by CodeEditor on every change
  const handleCodeChange = useCallback((code: string) => {
    codeRef.current = code

    // Show "analyzing" spinner 2s after last keystroke
    if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current)
    analyzeTimerRef.current = setTimeout(() => setIsAnalyzing(true), 2000)

    scheduleAnnotation(code, language)

    // Save snapshot every 5s via Next.js API (Supabase network access)
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    snapshotTimerRef.current = setTimeout(() => {
      const lang = languageRef.current
      fetch('/api/sessions/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code, language: lang }),
      }).catch(console.error)
    }, 5000)
  }, [scheduleAnnotation, language, sessionId])

  function handleCopy() {
    navigator.clipboard.writeText(viewerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="session-layout">
      {/* Top bar */}
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
          <button className="btn btn--ghost" onClick={handleCopy}>
            <CopyIcon />
            {copied ? 'Copied!' : 'Share link'}
          </button>
          <div className={`conn-badge ${isConnected ? 'conn-badge--connected' : 'conn-badge--disconnected'}`}>
            {isConnected ? '● Live' : '○ Connecting...'}
          </div>
        </div>
      </header>

      {/* Editor + sidebar */}
      <div className="session-body">
        <CodeEditor
          sessionId={sessionId}
          socket={socket}
          language={language}
          onLanguageChange={setLanguage}
          onCodeChange={handleCodeChange}
        />

        {/* Right sidebar */}
        <aside className="session-sidebar">
          {/* Session info */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Session</h3>
            <div className="sidebar-item">
              <span className="sidebar-label">Session ID</span>
              <code className="sidebar-value">{sessionId}</code>
            </div>
            <div className="sidebar-item">
              <span className="sidebar-label">Viewers</span>
              <span className="sidebar-value">{viewerCount}</span>
            </div>
            <div className="sidebar-item">
              <span className="sidebar-label">Language</span>
              <span className="sidebar-value">{language}</span>
            </div>
          </div>

          {/* Share */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Share</h3>
            <div className="share-url-box">
              <span className="share-url-text">{viewerUrl}</span>
            </div>
            <button className="btn btn--primary btn--full" onClick={handleCopy}>
              {copied ? '✓ Copied!' : 'Copy viewer link'}
            </button>
            <a
              href={`/replay/${sessionId}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost btn--full"
              style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              ⏮ Watch Replay
            </a>
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

          {activeTab === 'ai' ? (
            <AnnotationPanel annotations={annotations} isAnalyzing={isAnalyzing} />
          ) : (
            <QAPanel
              sessionId={sessionId}
              currentCode={''}
              language={language}
              socket={null}
              entries={qaEntries}
              viewerName="host"
              role="host"
            />
          )}
        </aside>
      </div>
    </div>
  )
}
