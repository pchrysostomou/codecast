'use client'

import { useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { Annotation } from '@/lib/annotate'

const DEBOUNCE_MS = 2000  // 2s after host stops typing

interface UseAIAnnotationOptions {
  sessionId: string
  socketRef: React.RefObject<Socket | null>
  /** Called directly on host when annotation arrives — no Railway round-trip needed */
  onAnnotation?: (annotation: Annotation) => void
}

export function useAIAnnotation({ sessionId, socketRef, onAnnotation }: UseAIAnnotationOptions) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousCodeRef = useRef<string>('')
  const isAnalyzing = useRef(false)

  const scheduleAnnotation = useCallback((currentCode: string, language: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      const previousCode = previousCodeRef.current

      if (currentCode === previousCode || isAnalyzing.current) return
      if (currentCode.trim().length < 10) return

      isAnalyzing.current = true

      try {
        const res = await fetch('/api/annotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: currentCode, previousCode, language, sessionId }),
        })

        if (!res.ok) return

        const { annotation } = (await res.json()) as { annotation: Annotation }
        if (!annotation) return

        // ── Deliver directly to host UI (works offline, no Railway round-trip) ──
        onAnnotation?.(annotation)

        // ── Broadcast to viewers via socket if connected ──
        const socket = socketRef.current
        if (socket?.connected) {
          socket.emit('annotation:new', { sessionId, annotation })
        }

        previousCodeRef.current = currentCode
      } catch (err) {
        console.error('[useAIAnnotation]', err)
      } finally {
        isAnalyzing.current = false
      }
    }, DEBOUNCE_MS)
  }, [sessionId, socketRef, onAnnotation])

  return { scheduleAnnotation }
}
