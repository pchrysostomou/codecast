'use client'

import { useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import type { Annotation } from '@/lib/annotate'

const DEBOUNCE_MS = 2000  // 2s after host stops typing

export function useAIAnnotation(sessionId: string, socketRef: React.RefObject<Socket | null>) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousCodeRef = useRef<string>('')
  const isAnalyzing = useRef(false)

  const scheduleAnnotation = useCallback((currentCode: string, language: string) => {
    // Clear any pending debounce
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(async () => {
      const previousCode = previousCodeRef.current

      // Skip if code hasn't changed meaningfully or already analyzing
      if (currentCode === previousCode || isAnalyzing.current) return
      if (currentCode.trim().length < 10) return  // too short to annotate

      isAnalyzing.current = true

      try {
        const res = await fetch('/api/annotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: currentCode,
            previousCode,
            language,
            sessionId,
          }),
        })

        if (!res.ok) return

        const { annotation } = (await res.json()) as { annotation: Annotation }
        if (!annotation) return

        // Broadcast annotation to all viewers in this session
        const socket = socketRef.current
        if (socket) {
          socket.emit('annotation:new', { sessionId, annotation })
        }

        // Update baseline for next diff
        previousCodeRef.current = currentCode
      } catch (err) {
        console.error('[useAIAnnotation]', err)
      } finally {
        isAnalyzing.current = false
      }
    }, DEBOUNCE_MS)
  }, [sessionId, socketRef])

  return { scheduleAnnotation }
}
