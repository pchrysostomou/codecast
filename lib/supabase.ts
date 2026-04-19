import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser-safe singleton
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types matching our DB schema ──────────────────────────────
export interface DBSession {
  id: string
  language: string
  created_at: string
  ended_at: string | null
  code_snapshot: string | null
}

export interface DBQuestion {
  id: string
  session_id: string
  viewer_name: string
  question: string
  answer: string | null
  asked_at: string
}
