'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import type { RunResult } from '@/app/api/run/route'

// Languages supported natively (no external API needed)
const SUPPORTED = new Set(['javascript', 'typescript', 'python', 'bash'])
const LANG_LABEL: Record<string, string> = {
  javascript: 'JS',
  typescript: 'TS',
  python:     'PY',
  bash:       'SH',
  java:       'Java',
  go:         'Go',
  c:          'C',
  cpp:        'C++',
  rust:       'Rust',
}

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

  const isSupported = SUPPORTED.has(language)
  const langBadge   = LANG_LABEL[language] ?? language.toUpperCase()

  // ── Viewer: receive broadcast ─────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const handler = (data: RunResult) => { setResult(data); setError(null) }
    socket.on('code:run:result', handler)
    return () => { socket.off('code:run:result', handler) }
  }, [socket])

  // ── Host: execute code ────────────────────────────────────────
  const runCode = useCallback(async () => {
    if (running || role !== 'host') return
    if (!isSupported) return

    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res  = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error ?? 'Execution failed'); return }

      setResult(data)
      socket?.emit('code:run', { sessionId, result: data })
    } catch {
      setError('Network error — could not reach execution service')
    } finally {
      setRunning(false)
    }
  }, [running, role, code, language, socket, sessionId, isSupported])

  // ── Ctrl+Enter shortcut ───────────────────────────────────────
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
          <span className="run-lang-badge">{langBadge}</span>
        </span>

        {result && (
          <span className={`run-badge ${result.exitCode === 0 ? 'run-badge--ok' : 'run-badge--err'}`}>
            {result.exitCode === 0 ? '✓ OK' : `✗ exit ${result.exitCode}`}
            <span className="run-time">{result.runtime}ms</span>
          </span>
        )}

        {/* Clear button */}
        {result && role === 'host' && (
          <button className="run-clear-btn" onClick={() => { setResult(null); setError(null) }} title="Clear output">
            ✕
          </button>
        )}

        {/* Run button — host only, supported language */}
        {role === 'host' && isSupported && (
          <button
            id="run-code-btn"
            className={`run-btn ${running ? 'run-btn--running' : ''}`}
            onClick={runCode}
            disabled={running}
            title="Run code (Ctrl+Enter)"
          >
            {running
              ? <span className="run-spinner" />
              : <svg width="11" height="12" viewBox="0 0 12 14" fill="currentColor"><path d="M1 1l10 6L1 13V1z"/></svg>
            }
            {running ? 'Running…' : 'Run'}
            {!running && <kbd className="run-kbd">⌃↵</kbd>}
          </button>
        )}
      </div>

      {/* Language not supported notice */}
      {!isSupported && role === 'host' && (
        <div className="terminal-unsupported">
          <span>⚠</span>
          <div>
            <strong>{language}</strong> requires a compiler and is not available
            in the serverless environment.
            <br />
            <span className="terminal-unsupported__hint">
              Supported: JavaScript · TypeScript · Python · Bash
            </span>
          </div>
        </div>
      )}

      {/* Output terminal */}
      {(isSupported || role === 'viewer') && (
        <div className="terminal-output">
          {!result && !error && !running && (
            <p className="terminal-placeholder">
              {role === 'host'
                ? `Press Run or Ctrl+Enter to execute (${language})`
                : 'Waiting for host to run code…'}
            </p>
          )}

          {running && (
            <p className="terminal-placeholder terminal-placeholder--running">
              ⏳ Running {language}…
            </p>
          )}

          {error && <p className="terminal-error">⚠ {error}</p>}

          {result && !hasOutput && !error && (
            <p className="terminal-placeholder terminal-placeholder--ok">✓ Finished with no output</p>
          )}

          {result && stdoutLines.map((line, i) => (
            <TerminalLine key={`out-${i}`} line={line} />
          ))}

          {stderrLines.map((line, i) => (
            <TerminalLine key={`err-${i}`} line={line} isErr />
          ))}
        </div>
      )}
    </div>
  )
}
