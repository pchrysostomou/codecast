/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest } from 'next/server'
import * as vm from 'vm'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────
export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  language: string
  runtime: number   // ms
}

// ── JS/TS execution via Node.js vm (no external API) ───────────
function runJavaScript(code: string): Omit<RunResult, 'language' | 'runtime'> {
  const outLines: string[] = []
  const errLines: string[] = []

  const sandbox = {
    console: {
      log:   (...args: unknown[]) => outLines.push(args.map(stringify).join(' ')),
      error: (...args: unknown[]) => errLines.push(args.map(stringify).join(' ')),
      warn:  (...args: unknown[]) => outLines.push('[warn] ' + args.map(stringify).join(' ')),
      info:  (...args: unknown[]) => outLines.push(args.map(stringify).join(' ')),
    },
    setTimeout:   undefined,
    setInterval:  undefined,
    fetch:        undefined,
    process:      undefined,
    global:       undefined,
    require:      undefined,
    __dirname:    undefined,
    __filename:   undefined,
  }

  try {
    const ctx = vm.createContext(sandbox)
    const script = new vm.Script(code, { filename: 'main.js' })
    script.runInContext(ctx, { timeout: 5000 })

    return {
      stdout: outLines.join('\n'),
      stderr: errLines.join('\n'),
      exitCode: errLines.length > 0 ? 1 : 0,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { stdout: outLines.join('\n'), stderr: msg, exitCode: 1 }
  }
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

// ── TypeScript: strip types with the bundled typescript package ─
function transpileTS(code: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = require('typescript') as any
  const result = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: false,
      esModuleInterop: true,
    },
    reportDiagnostics: false,
  })
  return result.outputText as string
}

// ── Piston fallback (for Python, Java, Go, etc.) ───────────────
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute'

const RUNTIME_MAP: Record<string, { language: string; version: string }> = {
  python: { language: 'python',  version: '3.10.0' },
  java:   { language: 'java',    version: '15.0.2' },
  c:      { language: 'c',       version: '10.2.0' },
  cpp:    { language: 'cpp',     version: '10.2.0' },
  rust:   { language: 'rust',    version: '1.50.0' },
  go:     { language: 'go',      version: '1.16.2' },
  bash:   { language: 'bash',    version: '5.2.0' },
}

async function runViaPiston(
  code: string,
  language: string,
): Promise<Omit<RunResult, 'language' | 'runtime'>> {
  const rt = RUNTIME_MAP[language]
  if (!rt) {
    return { stdout: '', stderr: `Language '${language}' is not supported for execution.`, exitCode: 1 }
  }

  // Try to get a matching runtime version from Piston first
  let version = rt.version
  try {
    const rtRes = await fetch(`https://emkc.org/api/v2/piston/runtimes`, { signal: AbortSignal.timeout(5000) })
    if (rtRes.ok) {
      const runtimes: Array<{ language: string; version: string }> = await rtRes.json()
      const match = runtimes.find(r => r.language === rt.language)
      if (match) version = match.version
    }
  } catch { /* ignore — use hardcoded version */ }

  const res = await fetch(PISTON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: rt.language,
      version,
      files: [{ name: 'main', content: code }],
      stdin: '',
      args: [],
      compile_timeout: 10000,
      run_timeout: 5000,
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    return {
      stdout: '',
      stderr: `Execution service error: ${res.status}`,
      exitCode: 1,
    }
  }

  const data = await res.json()
  return {
    stdout: data.run?.stdout ?? '',
    stderr: data.run?.stderr ?? (data.compile?.stderr ?? ''),
    exitCode: data.run?.code ?? -1,
  }
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { code, language } = await req.json() as { code: string; language: string }

  if (!code?.trim()) {
    return Response.json({ error: 'No code provided' }, { status: 400 })
  }

  const t0 = Date.now()
  let partial: Omit<RunResult, 'language' | 'runtime'>

  try {
    if (language === 'javascript') {
      // Run directly in Node.js vm sandbox
      partial = runJavaScript(code)
    } else if (language === 'typescript') {
      // Transpile TS → JS then run in vm
      const js = transpileTS(code)
      partial = runJavaScript(js)
    } else {
      // Use Piston API for all other languages
      partial = await runViaPiston(code, language)
    }
  } catch (err: unknown) {
    console.error('[api/run] error:', err)
    const msg = err instanceof Error ? err.message : 'Internal execution error'
    partial = { stdout: '', stderr: msg, exitCode: 1 }
  }

  const result: RunResult = {
    ...partial,
    language,
    runtime: Date.now() - t0,
  }

  return Response.json(result)
}
