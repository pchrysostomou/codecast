import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute'

// Map our language names to Piston runtime names
const RUNTIME_MAP: Record<string, { language: string; version: string }> = {
  javascript:  { language: 'javascript', version: '18.15.0' },
  typescript:  { language: 'typescript', version: '5.0.3' },
  python:      { language: 'python',     version: '3.10.0' },
  java:        { language: 'java',       version: '15.0.2' },
  c:           { language: 'c',          version: '10.2.0' },
  cpp:         { language: 'cpp',        version: '10.2.0' },
  rust:        { language: 'rust',       version: '1.50.0' },
  go:          { language: 'go',         version: '1.16.2' },
  bash:        { language: 'bash',       version: '5.2.0' },
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  language: string
  runtime: number   // ms
}

export async function POST(req: NextRequest) {
  const { code, language } = await req.json()

  if (!code?.trim()) {
    return Response.json({ error: 'No code provided' }, { status: 400 })
  }

  const runtime = RUNTIME_MAP[language] ?? RUNTIME_MAP['javascript']
  const t0 = Date.now()

  try {
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: 'main', content: code }],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[api/run] Piston error:', res.status, text)
      return Response.json({ error: `Execution service error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const elapsed = Date.now() - t0

    const result: RunResult = {
      stdout: data.run?.stdout ?? '',
      stderr: data.run?.stderr ?? (data.compile?.stderr ?? ''),
      exitCode: data.run?.code ?? -1,
      language: runtime.language,
      runtime: elapsed,
    }

    return Response.json(result)
  } catch (err) {
    console.error('[api/run] fetch error:', err)
    return Response.json({ error: 'Could not reach execution service' }, { status: 503 })
  }
}
