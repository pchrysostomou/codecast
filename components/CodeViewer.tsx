'use client'

import MonacoEditor from '@monaco-editor/react'

interface CodeViewerProps {
  code: string
  language?: string
  isConnected: boolean
}

export function CodeViewer({ code, language = 'typescript', isConnected }: CodeViewerProps) {
  return (
    <div className="editor-wrapper">
      <div className="editor-toolbar">
        <div className="viewer-status">
          <span className={`status-dot ${isConnected ? 'status-dot--live' : 'status-dot--offline'}`} />
          <span>{isConnected ? 'Live' : 'Connecting...'}</span>
        </div>
        <span className="toolbar-hint lang-badge">{language}</span>
      </div>

      <MonacoEditor
        height="calc(100vh - 120px)"
        language={language}
        theme="vs-dark"
        value={code}
        options={{
          fontSize: 14,
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          readOnly: true,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'none',
          cursorStyle: 'line',
          padding: { top: 16, bottom: 16 },
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
        }}
      />
    </div>
  )
}
