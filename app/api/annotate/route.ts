import { annotateCode, computeDiff } from '@/lib/annotate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { code, previousCode, language, sessionId } = await request.json()

    if (!code || typeof code !== 'string') {
      return Response.json({ error: 'Missing code' }, { status: 400 })
    }

    const prev = previousCode ?? ''
    const diff = computeDiff(prev, code)

    if (!diff.hasChanges) {
      return Response.json({ error: 'No changes detected' }, { status: 204 })
    }

    const annotation = await annotateCode(code, diff, language ?? 'typescript')

    return Response.json({ annotation, sessionId })
  } catch (err) {
    console.error('[/api/annotate]', err)
    return Response.json(
      { error: 'Annotation failed', detail: String(err) },
      { status: 500 }
    )
  }
}
