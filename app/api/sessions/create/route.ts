import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Called by the frontend when a host joins a session.
// This way session persistence always goes through Next.js (which has network
// access to Supabase), rather than through the Socket.io server process.
export async function POST(req: NextRequest) {
  const { sessionId, language = 'typescript' } = await req.json()

  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.from('codecast_sessions').upsert({
    id: sessionId,
    language,
    created_at: new Date().toISOString(),
    ended_at: null,
    code_snapshot: null,
  }, { onConflict: 'id' })

  if (error) {
    console.error('[api/sessions/create] Supabase error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, sessionId })
}
