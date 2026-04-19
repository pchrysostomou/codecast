import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fetch session metadata
  const { data: session, error: sessionErr } = await supabase
    .from('codecast_sessions')
    .select('id, language, created_at, ended_at, code_snapshot')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  // Fetch ordered snapshots
  const { data: snapshots, error: snapErr } = await supabase
    .from('codecast_snapshots')
    .select('id, code, language, captured_at')
    .eq('session_id', sessionId)
    .order('captured_at', { ascending: true })

  if (snapErr) {
    return Response.json({ error: 'Failed to fetch snapshots' }, { status: 500 })
  }

  return Response.json({
    session,
    snapshots: snapshots ?? [],
    totalSnapshots: snapshots?.length ?? 0,
  })
}
