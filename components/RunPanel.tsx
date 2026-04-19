'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { RunResult } from '@/app/api/run/route'

// JS/TS: instant via vm  |  Python/Java/Go/C/C++/Rust/Bash: via Railway→Wandbox
const SUPPORTED = new Set(['javascript', 'typescript', 'python', 'java', 'go', 'c', 'cpp', 'rust', 'bash'])

const LANG_BADGE: Record<string, string> = {
  javascript: 'JS',  typescript: 'TS',
  python:     'PY',  java: 'Java',
  go:         'Go',  c: 'C', cpp: 'C++',
  rust:       'Rust', bash: 'Bash',
}

// ── Component ─────────────────────────────────────────────────
interface RunPanelProps {
  code: string
  language: string
  socket: Socket | null
  role: 'host' | 'viewer'
  sessionId: string
}

function TerminalLine({ line, isErr }: { line: string; isErr?: boolean }) {
  return <div className={`terminal-line${isErr ? ' terminal-line--err' : ''}`}>{line || ' '}</div>
}

export function RunPanel({ code, language, socket, role, sessionId }: RunPanelProps) {
  const [running, setRunning]   = useState(false)
  const [result, setResult]     = useState<RunResult | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isLocal    = language === 'javascript' || language === 'typescript'
  const isSupported = SUPPORTED.has(language)
  const badge       = LANG_BADGE[language] ?? language.toUpperCase()

  // ── Viewer: receive broadcast ─────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const handler = (data: RunResult) => { setResult(data); setError(null) }
    socket.on('code:run:result', handler)
    return () => { socket.off('code:run:result', handler) }
  }, [socket])

  // ── Host: run code ────────────────────────────────────────────
  const runCode = useCallback(async () => {
    if (running || role !== 'host' || !isSupported) return
    setRunning(true); setError(null); setResult(null)

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
        signal: abortRef.current.signal,
      })
      const data: RunResult = await res.json()
      if (!res.ok) { setError((data as { error?: string }).error ?? 'Execution failed'); return }
      setResult(data)
      socket?.emit('code:run', { sessionId, result: data })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execution error'
      if (msg !== 'The user aborted a request.') setError(msg)
    } finally {
      setRunning(false)
    }
  }, [running, role, code, language, socket, sessionId, isSupported])

  // ── Ctrl+Enter ────────────────────────────────────────────────
  useEffect(() => {
    if (role !== 'host') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [role, runCode])

  const stdoutLines = (result?.stdout ?? '').split('\n')
  const stderrLines = (result?.stderr ?? '').split('\n').filter(Boolean)
  const hasOutput   = stdoutLines.some(l => l.trim()) || stderrLines.length > 0

  return (
    <div className="run-panel">
      {/* Header */}
      <div className="run-panel__header">
        <span className="run-panel__title">
          <span className="run-dot" />
          Terminal
          <span className={`run-lang-badge ${!isLocal ? 'run-lang-badge--cloud' : ''}`}>
            {badge}
          </span>
        </span>

        {result && (
          <span className={`run-badge ${result.exitCode === 0 ? 'run-badge--ok' : 'run-badge--err'}`}>
            {result.exitCode === 0 ? '✓' : '✗'} {result.runtime}ms
          </span>
        )}

        {result && role === 'host' && (
          <button className="run-clear-btn" onClick={() => { setResult(null); setError(null) }} title="Clear">✕</button>
        )}

        {role === 'host' && isSupported && (
          <button
            id="run-code-btn"
            className={`run-btn ${running ? 'run-btn--running' : ''}`}
            onClick={runCode}
            disabled={running}
            title={`Run ${language} (Ctrl+Enter)`}
          >
            {running
              ? <span className="run-spinner" />
              : <svg width="10" height="12" viewBox="0 0 12 14" fill="currentColor"><path d="M1 1l10 6L1 13V1z"/></svg>}
            {running ? 'Running…' : 'Run'}
            {!running && <kbd className="run-kbd">⌃↵</kbd>}
          </button>
        )}
      </div>

      {/* Unsupported notice */}
      {!isSupported && role === 'host' && (
        <div className="terminal-unsupported">
          <span>⚠</span>
          <div>
            <strong>{language}</strong> is not supported for execution.
            <br /><span className="terminal-unsupported__hint">Supported: JS · TS · Python · Java · Go · C · C++ · Rust · Bash</span>
          </div>
        </div>
      )}

      {/* Terminal output */}
      <div className="terminal-output">
        {!result && !error && !running && (
          <p className="terminal-placeholder">
            {role === 'host'
              ? isSupported
                ? `Press ▶ Run or Ctrl+Enter to execute (${language}${!isLocal ? ' via cloud' : ''})`
                : `${language} is not supported`
              : 'Waiting for host to run code…'}
          </p>
        )}

        {running && (
          <p className="terminal-placeholder terminal-placeholder--running">
            {isLocal ? '⚡' : '☁'} Running {language}…
            {!isLocal && <span style={{ fontSize: '10px', opacity: 0.65 }}> (compiling in cloud, ~5-15s)</span>}
          </p>
        )}

        {error && <p className="terminal-error">⚠ {error}</p>}

        {result && !hasOutput && (
          <p className="terminal-placeholder terminal-placeholder--ok">✓ Ran — no output</p>
        )}

        {result && stdoutLines.map((line, i) => (
          <TerminalLine key={`out-${i}`} line={line} />
        ))}
        {stderrLines.map((line, i) => (
          <TerminalLine key={`err-${i}`} line={line} isErr />
        ))}
      </div>
    </div>
  )
}
