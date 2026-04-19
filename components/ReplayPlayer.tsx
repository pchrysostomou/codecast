'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CodeViewer } from '@/components/CodeViewer'

export interface Snapshot {
  id: string
  code: string
  language: string
  captured_at: string
}

interface ReplayPlayerProps {
  snapshots: Snapshot[]
  language: string
}

const SPEEDS = [0.5, 1, 2, 4] as const

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function ReplayPlayer({ snapshots, language }: ReplayPlayerProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1) // default 1×
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const speed = SPEEDS[speedIdx]
  const total = snapshots.length
  const current = snapshots[currentIdx]

  // Compute relative timestamps from first snapshot
  const t0 = total > 0 ? new Date(snapshots[0].captured_at).getTime() : 0
  const tCurrent = current ? new Date(current.captured_at).getTime() - t0 : 0
  const tTotal = total > 0 ? new Date(snapshots[total - 1].captured_at).getTime() - t0 : 0

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setPlaying(false)
  }, [])

  const play = useCallback(() => {
    if (currentIdx >= total - 1) setCurrentIdx(0)
    setPlaying(true)
  }, [currentIdx, total])

  useEffect(() => {
    if (!playing) return

    const STEP_MS = 800 / speed

    intervalRef.current = setInterval(() => {
      setCurrentIdx((idx) => {
        if (idx >= total - 1) {
          stop()
          return idx
        }
        return idx + 1
      })
    }, STEP_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, speed, total, stop])

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    stop()
    setCurrentIdx(Number(e.target.value))
  }

  function cycleSpeed() {
    setSpeedIdx((i) => (i + 1) % SPEEDS.length)
  }

  if (total === 0) {
    return (
      <div className="replay-empty">
        <p>No snapshots recorded for this session.</p>
        <p className="replay-empty__sub">Snapshots are captured every 5 seconds during a live session.</p>
      </div>
    )
  }

  return (
    <div className="replay-player">
      {/* Monaco viewer */}
      <div className="replay-editor">
        <CodeViewer
          code={current?.code ?? ''}
          language={current?.language ?? language}
          isConnected={false}
        />
      </div>

      {/* Controls */}
      <div className="replay-controls">
        {/* Timeline scrubber */}
        <div className="replay-timeline">
          <span className="replay-time">{formatTime(tCurrent)}</span>
          <input
            type="range"
            className="replay-scrubber"
            min={0}
            max={total - 1}
            value={currentIdx}
            onChange={handleScrub}
          />
          <span className="replay-time">{formatTime(tTotal)}</span>
        </div>

        {/* Buttons row */}
        <div className="replay-buttons">
          {/* Rewind */}
          <button
            className="replay-btn"
            onClick={() => { stop(); setCurrentIdx(0) }}
            aria-label="Restart"
            title="Restart"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6l-8.5 6z"/>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            className="replay-btn replay-btn--primary"
            onClick={playing ? stop : play}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Speed */}
          <button className="replay-btn replay-speed" onClick={cycleSpeed} title="Playback speed">
            {speed}×
          </button>

          {/* Frame counter */}
          <span className="replay-counter">{currentIdx + 1} / {total}</span>
        </div>
      </div>
    </div>
  )
}
