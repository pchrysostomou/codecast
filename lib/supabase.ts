import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key_for_ci'

// Browser-safe singleton.
// Falls back to placeholder values in CI/test environments where Supabase
// env vars are not configured — prevents "supabaseKey is required" crash.
// All DB operations will simply error out gracefully (caught in each call site).
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
