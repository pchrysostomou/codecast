'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import type { RunResult } from '@/app/api/run/route'

interface RunPanelProps {
  code: string
  language: string
  socket: Socket | null
  role: 'host' | 'viewer'
  sessionId: string
}

function TerminalLine({ line }: { line: string }) {
  // Color stderr-style lines red, normal lines white
  return <div className="terminal-line">{line || ' '}</div>
}

export function RunPanel({ code, language, socket, role, sessionId }: RunPanelProps) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Listen for run results broadcast from host (viewer mode)
  useEffect(() => {
    if (!socket) return
    const handleRunResult = (data: RunResult) => {
      setResult(data)
      setError(null)
    }
    socket.on('code:run:result', handleRunResult)
    return () => { socket.off('code:run:result', handleRunResult) }
  }, [socket])

  const runCode = useCallback(async () => {
    if (running || role !== 'host') return
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Execution failed')
        setRunning(false)
        return
      }

      setResult(data)
      // Broadcast to all viewers in this session
      socket?.emit('code:run', { sessionId, result: data })
    } catch {
      setError('Network error — could not reach execution service')
    } finally {
      setRunning(false)
    }
  }, [running, role, code, language, socket, sessionId])

  // Ctrl+Enter shortcut (host only)
  useEffect(() => {
    if (role !== 'host') return
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        runCode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [role, runCode])

  const stdoutLines = result?.stdout.split('\n') ?? []
  const stderrLines = result?.stderr.split('\n').filter(Boolean) ?? []
  const hasOutput   = stdoutLines.some(l => l.trim()) || stderrLines.length > 0

  return (
    <div className="run-panel">
      {/* Header */}
      <div className="run-panel__header">
        <span className="run-panel__title">
          <span className="run-dot" />
          Terminal
        </span>
        {result && (
          <span className={`run-badge ${result.exitCode === 0 ? 'run-badge--ok' : 'run-badge--err'}`}>
            {result.exitCode === 0 ? '✓ OK' : `✗ exit ${result.exitCode}`}
            <span className="run-time">{result.runtime}ms</span>
          </span>
        )}
        {role === 'host' && (
          <button
            id="run-code-btn"
            className={`run-btn ${running ? 'run-btn--running' : ''}`}
            onClick={runCode}
            disabled={running}
            title="Run code (Ctrl+Enter)"
          >
            {running ? (
              <span className="run-spinner" />
            ) : (
              <svg width="11" height="12" viewBox="0 0 12 14" fill="currentColor">
                <path d="M1 1l10 6L1 13V1z"/>
              </svg>
            )}
            {running ? 'Running…' : 'Run'}
            {!running && <kbd className="run-kbd">⌃↵</kbd>}
          </button>
        )}
      </div>

      {/* Output */}
      <div className="terminal-output">
        {!result && !error && !running && (
          <p className="terminal-placeholder">
            {role === 'host'
              ? 'Press Run or Ctrl+Enter to execute your code'
              : 'Waiting for host to run code…'}
          </p>
        )}

        {running && (
          <p className="terminal-placeholder terminal-placeholder--running">
            ⏳ Executing…
          </p>
        )}

        {error && (
          <p className="terminal-error">⚠ {error}</p>
        )}

        {result && !hasOutput && !error && (
          <p className="terminal-placeholder terminal-placeholder--ok">✓ No output</p>
        )}

        {result && stdoutLines.map((line, i) => (
          <TerminalLine key={`out-${i}`} line={line} />
        ))}

        {stderrLines.map((line, i) => (
          <div key={`err-${i}`} className="terminal-line terminal-line--err">{line}</div>
        ))}
      </div>
    </div>
  )
}
