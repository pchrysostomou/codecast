import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || ''

const db = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

export async function saveSnapshot(
  sessionId: string,
  code: string,
  language: string
): Promise<void> {
  if (!db || !code.trim()) return
  await db.from('codecast_snapshots').insert({
    session_id: sessionId,
    code,
    language,
    captured_at: new Date().toISOString(),
  })
}
