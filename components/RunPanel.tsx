'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { RunResult } from '@/app/api/run/route'

// Languages that run server-side via vm (instant, no API)
const SERVER_LANGS = new Set(['javascript', 'typescript'])
// Languages that run client-side in-browser
const CLIENT_LANGS = new Set(['python'])

const LANG_LABEL: Record<string, string> = {
  javascript: 'JS',
  typescript: 'TS',
  python:     'PY (Skulpt)',
  java:       'Java',
  go:         'Go',
  c:          'C',
  cpp:        'C++',
  rust:       'Rust',
  bash:       'Bash',
}

// ── Skulpt loader (Python in browser) ────────────────────────
let skulptLoaded = false
let skulptLoading: Promise<void> | null = null

function loadSkulpt(): Promise<void> {
  if (skulptLoaded) return Promise.resolve()
  if (skulptLoading) return skulptLoading

  skulptLoading = new Promise((resolve, reject) => {
    const s1 = document.createElement('script')
    s1.src = 'https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js'
    s1.onload = () => {
      const s2 = document.createElement('script')
      s2.src = 'https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js'
      s2.onload = () => { skulptLoaded = true; resolve() }
      s2.onerror = reject
      document.head.appendChild(s2)
    }
    s1.onerror = reject
    document.head.appendChild(s1)
  })
  return skulptLoading
}

async function runPythonInBrowser(code: string): Promise<RunResult> {
  const t0 = Date.now()
  const out: string[] = []

  try {
    await loadSkulpt()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sk = (window as any).Sk
    Sk.configure({
      output:   (text: string) => { out.push(text) },
      read:     (x: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (Sk.builtinFiles?.files[x] !== undefined) return (Sk.builtinFiles as any).files[x]
        throw new Error(`File not found: ${x}`)
      },
      execLimit: 5000,
    })

    await Sk.misceval.asyncToPromise(() =>
      Sk.importMainWithBody('<stdin>', false, code, true),
    )

    return { stdout: out.join(''), stderr: '', exitCode: 0, language: 'python', runtime: Date.now() - t0 }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { stdout: out.join(''), stderr: msg, exitCode: 1, language: 'python', runtime: Date.now() - t0 }
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
  const abortRef = useRef<AbortController | null>(null)

  const isServer   = SERVER_LANGS.has(language)
  const isClient   = CLIENT_LANGS.has(language)
  const isSupported = isServer || isClient
  const langBadge   = LANG_LABEL[language] ?? language.toUpperCase()

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
        // Python: run client-side via Skulpt (no API, no server)
        data = await runPythonInBrowser(code)

      } else {
        // JS/TS: run server-side via vm
        abortRef.current = new AbortController()
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
          signal: abortRef.current.signal,
        })
        data = await res.json()
        if (!res.ok) { setError((data as { error?: string }).error ?? 'Execution failed'); return }
      }

      setResult(data)
      // Broadcast result to all viewers
      socket?.emit('code:run', { sessionId, result: data })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execution error'
      if (msg !== 'The user aborted a request.') setError(msg)
    } finally {
      setRunning(false)
    }
  }, [running, role, code, language, socket, sessionId, isSupported, isClient])

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
          <span className={`run-lang-badge ${isClient ? 'run-lang-badge--client' : ''}`}>
            {langBadge}
          </span>
        </span>

        {result && (
          <span className={`run-badge ${result.exitCode === 0 ? 'run-badge--ok' : 'run-badge--err'}`}>
            {result.exitCode === 0 ? '✓ OK' : `✗ exit ${result.exitCode}`}
            <span className="run-time">{result.runtime}ms</span>
          </span>
        )}

        {result && role === 'host' && (
          <button className="run-clear-btn" onClick={() => { setResult(null); setError(null) }} title="Clear output">
            ✕
          </button>
        )}

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
              : <svg width="11" height="12" viewBox="0 0 12 14" fill="currentColor"><path d="M1 1l10 6L1 13V1z"/></svg>}
            {running ? 'Running…' : 'Run'}
            {!running && <kbd className="run-kbd">⌃↵</kbd>}
          </button>
        )}
      </div>

      {/* Unsupported language notice */}
      {!isSupported && role === 'host' && (
        <div className="terminal-unsupported">
          <span>⚠</span>
          <div>
            <strong>{language}</strong> requires a compiler — not available in this environment.
            <br />
            <span className="terminal-unsupported__hint">
              ✓ Supported: JavaScript · TypeScript · Python (Skulpt)
            </span>
          </div>
        </div>
      )}

      {/* Terminal output */}
      <div className="terminal-output">
        {!result && !error && !running && (
          <p className="terminal-placeholder">
            {role === 'host'
              ? isSupported
                ? `Press ▶ Run or Ctrl+Enter to execute (${language})`
                : `${language} is not supported for execution`
              : 'Waiting for host to run code…'}
          </p>
        )}

        {running && (
          <p className="terminal-placeholder terminal-placeholder--running">
            {isClient ? '🐍' : '⚡'} Running {language}…
            {isClient && <span style={{ fontSize: '10px', opacity: 0.7 }}> (loading Skulpt if first run)</span>}
          </p>
        )}

        {error && <p className="terminal-error">⚠ {error}</p>}

        {result && !hasOutput && !error && (
          <p className="terminal-placeholder terminal-placeholder--ok">✓ Ran successfully — no output</p>
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
