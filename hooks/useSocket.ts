'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export function useSocket() {
  const [socket, setSocket]       = useState<Socket | null>(null)
  const socketRef                 = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isOffline, setIsOffline] = useState(false)   // true after all retries fail
  const [viewerCount, setViewerCount] = useState(0)

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
    })

    socketRef.current = s

    s.on('connect', () => {
      setSocket(s)
      setIsConnected(true)
      setIsOffline(false)
    })
    s.on('disconnect', () => setIsConnected(false))
    s.on('connect_error', () => { /* handled by reconnect_failed */ })
    // After all retry attempts are exhausted → mark offline
    s.on('reconnect_failed', () => {
      setIsOffline(true)
      setIsConnected(false)
    })
    s.on('viewers:update', ({ count }: { count: number }) => setViewerCount(count))

    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [])

  return { socket, socketRef, isConnected, isOffline, viewerCount }
}
