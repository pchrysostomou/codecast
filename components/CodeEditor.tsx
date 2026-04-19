'use client'

import { useRef, useEffect, useCallback } from 'react'
import MonacoEditor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import type { Socket } from 'socket.io-client'

interface CodeEditorProps {
  sessionId: string
  socket: Socket | null
  language?: string
  onLanguageChange?: (lang: string) => void
  onCodeChange?: (code: string) => void   // ← W2: AI annotation hook
}

const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'rust', 'go',
  'java', 'cpp', 'csharp', 'html', 'css', 'json', 'markdown',
]

let throttleTimer: ReturnType<typeof setTimeout> | null = null

export function CodeEditor({ sessionId, socket, language = 'typescript', onLanguageChange, onCodeChange }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance
    // Focus editor on mount
    editorInstance.focus()
  }

  const handleChange = useCallback((value: string | undefined) => {
    if (!value || !socket) return

    // Throttle to 100ms — send last state, not every keystroke
    if (throttleTimer) clearTimeout(throttleTimer)
    throttleTimer = setTimeout(() => {
      socket.emit('code:change', {
        sessionId,
        code: value,
        timestamp: Date.now(),
      })
    }, 100)

    // Notify parent for AI annotation scheduling (debounced separately)
    onCodeChange?.(value)
  }, [socket, sessionId, onCodeChange])

  return (
    <div className="editor-wrapper">
      {/* Language selector */}
      <div className="editor-toolbar">
        <select
          className="lang-select"
          value={language}
          onChange={(e) => onLanguageChange?.(e.target.value)}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <span className="toolbar-hint">Editing — changes sync in real-time</span>
      </div>

      <MonacoEditor
        height="calc(100vh - 120px)"
        language={language}
        theme="vs-dark"
        defaultValue={`// Welcome to CodeCast 🎬\n// Start typing — viewers see every change live.\n\nasync function fetchUser(id: string) {\n  // Your code here...\n}\n`}
        onChange={handleChange}
        onMount={handleMount}
        options={{
          fontSize: 14,
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          readOnly: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  )
}
