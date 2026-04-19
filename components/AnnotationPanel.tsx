'use client'

import type { Annotation } from '@/lib/annotate'

interface AnnotationPanelProps {
  annotations: Annotation[]
  isAnalyzing: boolean
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5) return 'just now'
  if (diff < 60) return `${diff}s ago`
  return `${Math.floor(diff / 60)}m ago`
}

function BotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M12 11V3" />
      <circle cx="12" cy="3" r="1" />
      <path d="M7 15h.01M17 15h.01" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="spinner-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export function AnnotationPanel({ annotations, isAnalyzing }: AnnotationPanelProps) {
  return (
    <div className="annotation-panel">
      {/* Header */}
      <div className="annotation-header">
        <div className="annotation-header__title">
          <BotIcon />
          <span>AI Annotations</span>
        </div>
        {isAnalyzing && (
          <div className="annotation-analyzing">
            <SpinnerIcon />
            <span>Analyzing...</span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {annotations.length === 0 && !isAnalyzing && (
        <div className="annotation-empty">
          <p>AI will explain code changes automatically.</p>
          <p className="annotation-empty__hint">Waits 2s after you stop typing.</p>
        </div>
      )}

      {/* Annotation cards — newest first */}
      <div className="annotation-list">
        {[...annotations].reverse().map((ann, i) => (
          <div key={`${ann.timestamp}-${i}`} className={`annotation-card ${i === 0 ? 'annotation-card--new' : ''}`}>
            <div className="annotation-card__meta">
              <span className="annotation-card__line">Line {ann.line}</span>
              <span className="annotation-card__lang">{ann.language}</span>
              <span className="annotation-card__time">{timeAgo(ann.timestamp)}</span>
            </div>
            <p className="annotation-card__text">{ann.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
