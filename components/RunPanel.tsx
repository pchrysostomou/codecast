'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { RunResult } from '@/app/api/run/route'

// JS/TS: server-side vm  |  Python: Pyodide WASM in browser
const SUPPORTED = new Set(['javascript', 'typescript', 'python'])

const LANG_BADGE: Record<string, string> = {
  javascript: 'JS', typescript: 'TS', python: 'PY',
  java: 'Java', go: 'Go', c: 'C', cpp: 'C++', rust: 'Rust', bash: 'Bash',
}

// ── Pyodide loader (CPython WASM) ─────────────────────────────
// Loads once, then cached. First run ~5-10s, subsequent runs instant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null
let pyodideLoading: Promise<void> | null = null

function ensurePyodide(): Promise<void> {
  if (pyodideInstance) return Promise.resolve()
  if (pyodideLoading) return pyodideLoading

  pyodideLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js'
    script.onload = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pyodideInstance = await (window as any).loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
          stdout: () => {},    // will be overridden per-run
          stderr: () => {},
        })
        resolve()
      } catch (e) { reject(e) }
    }
    script.onerror = () => reject(new Error('Failed to load Pyodide'))
    document.head.appendChild(script)
  })
  return pyodideLoading
}

async function runPython(code: string): Promise<RunResult> {
  const t0 = Date.now()
  const stdout: string[] = []
  const stderr: string[] = []

  try {
    await ensurePyodide()

    // Redirect stdout/stderr per-run
    pyodideInstance.setStdout({ batched: (s: string) => stdout.push(s) })
    pyodideInstance.setStderr({ batched: (s: string) => stderr.push(s) })

    await pyodideInstance.runPythonAsync(code)

    return {
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      exitCode: 0, language: 'python', runtime: Date.now() - t0,
    }
  } catch (e: unknown) {
    // Pyodide surfaces Python tracebacks as JS errors
    const msg = e instanceof Error ? e.message : String(e)
    return {
      stdout: stdout.join('\n'),
      stderr: msg,
      exitCode: 1, language: 'python', runtime: Date.now() - t0,
    }
  }
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
  const [firstRun, setFirstRun] = useState(true) // track if Pyodide hasn't loaded yet
  const abortRef = useRef<AbortController | null>(null)

  const isClient   = language === 'python'
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

    let data: RunResult | null = null
    try {
      if (isClient) {
        // Python → Pyodide WASM (no server needed)
        if (firstRun) setFirstRun(false)
        data = await runPython(code)
      } else {
        // JS/TS → Vercel vm sandbox
        abortRef.current = new AbortController()
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
          signal: abortRef.current.signal,
        })
        data = await res.json() as RunResult
        if (!res.ok) { setError((data as { error?: string }).error ?? 'Execution failed'); return }
      }

      setResult(data)
      socket?.emit('code:run', { sessionId, result: data })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execution error'
      if (msg !== 'The user aborted a request.') setError(msg)
    } finally {
      setRunning(false)
    }
  }, [running, role, code, language, socket, sessionId, isSupported, isClient, firstRun])

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
          <span className={`run-lang-badge${isClient ? ' run-lang-badge--cloud' : ''}`}>
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
            <strong>{language}</strong> execution is not available in this environment.
            <br /><span className="terminal-unsupported__hint">✓ Supported: JavaScript · TypeScript · Python</span>
          </div>
        </div>
      )}

      {/* Terminal output */}
      <div className="terminal-output">
        {!result && !error && !running && (
          <p className="terminal-placeholder">
            {role === 'host'
              ? isSupported
                ? `Press ▶ Run or Ctrl+Enter to execute (${language}${isClient && firstRun ? ' — first run loads Python WASM ~5s' : ''})`
                : `${language} is not supported for execution`
              : 'Waiting for host to run code…'}
          </p>
        )}

        {running && (
          <p className="terminal-placeholder terminal-placeholder--running">
            {isClient ? '🐍' : '⚡'} Running {language}…
            {isClient && firstRun && <span style={{ fontSize: '10px', opacity: 0.7 }}> (loading Python, ~5s first time)</span>}
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
