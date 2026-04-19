import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Called by the frontend every 5s during a live session to persist code snapshots.
// This bypasses the Socket.io server (no network access locally).
export async function POST(req: NextRequest) {
  const { sessionId, code, language = 'typescript' } = await req.json()

  if (!sessionId || code === undefined) {
    return Response.json({ error: 'sessionId and code required' }, { status: 400 })
  }

  if (!code.trim()) return Response.json({ ok: true, skipped: true })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.from('codecast_snapshots').insert({
    session_id: sessionId,
    code,
    language,
    captured_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[api/sessions/snapshot] Supabase error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
