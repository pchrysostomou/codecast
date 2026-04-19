'use client'

import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export function useSocket() {
  // socket stored as state so consumers re-render when it's ready
  const [socket, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = s

    // setState inside event callbacks is fine — not synchronous in effect body
    s.on('connect', () => {
      setSocket(s)          // expose socket after connection
      setIsConnected(true)
    })
    s.on('disconnect', () => setIsConnected(false))
    s.on('viewers:update', ({ count }: { count: number }) => setViewerCount(count))

    return () => {
      s.disconnect()
      socketRef.current = null
    }
  }, [])

  return { socket, socketRef, isConnected, viewerCount }
}
