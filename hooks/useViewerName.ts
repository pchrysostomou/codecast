'use client'

import { useState } from 'react'

const ADJECTIVES = ['swift', 'bright', 'cool', 'keen', 'bold', 'calm', 'deft', 'free', 'wise', 'zest']
const NOUNS = ['dev', 'coder', 'hacker', 'nerd', 'geek', 'byte', 'pixel', 'node', 'scope', 'stack']

function generateName(): string {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num  = Math.floor(Math.random() * 900) + 100
  return `${adj}_${noun}${num}`
}

const STORAGE_KEY = 'codecast_viewer_name'

/**
 * Returns a stable random viewer name persisted in localStorage.
 * Initialized lazily on first render — no effect needed.
 * e.g. "swift_dev482", "bold_coder731"
 */
export function useViewerName(): string {
  const [name] = useState<string>(() => {
    // Runs once on mount (client-side only). No effect needed.
    if (typeof window === 'undefined') return 'guest'
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
    const n = generateName()
    localStorage.setItem(STORAGE_KEY, n)
    return n
  })

  return name
}
