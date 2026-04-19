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
  runtime: number
}
type Partial = Omit<RunResult, 'language' | 'runtime'>

// ── Languages handled locally (no external API) ─────────────────
const LOCAL_LANGS = new Set(['javascript', 'typescript'])

// ── Railway server URL (for cloud compilation) ──────────────────
const RAILWAY_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'https://codecast-production.up.railway.app'

// ──────────────────────────────────────────────────────────────
//  JavaScript — Node.js vm sandbox (instant)
// ──────────────────────────────────────────────────────────────
function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function runInVm(js: string): Partial {
  const out: string[] = []
  const err: string[] = []

  const sandbox = {
    console: {
      log:   (...a: unknown[]) => out.push(a.map(stringify).join(' ')),
      error: (...a: unknown[]) => err.push(a.map(stringify).join(' ')),
      warn:  (...a: unknown[]) => out.push('[warn] ' + a.map(stringify).join(' ')),
      info:  (...a: unknown[]) => out.push(a.map(stringify).join(' ')),
    },
    Math, Date, JSON, parseInt, parseFloat,
    isNaN, isFinite, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: undefined, setInterval: undefined,
    fetch: undefined, process: undefined, global: undefined, require: undefined,
  }

  try {
    vm.runInNewContext(js, sandbox, { timeout: 5000, filename: 'main.js' })
    return { stdout: out.join('\n'), stderr: err.join('\n'), exitCode: err.length ? 1 : 0 }
  } catch (e: unknown) {
    return { stdout: out.join('\n'), stderr: e instanceof Error ? e.message : String(e), exitCode: 1 }
  }
}

// ── TypeScript → JavaScript ─────────────────────────────────────
function transpileTS(code: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = require('typescript') as any
  return ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: false,
      esModuleInterop: true,
    },
  }).outputText as string
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { code, language } = await req.json() as { code: string; language: string }

  if (!code?.trim()) {
    return Response.json({ error: 'No code provided' }, { status: 400 })
  }

  const t0 = Date.now()
  let partial: Partial

  try {
    if (language === 'javascript') {
      partial = runInVm(code)

    } else if (language === 'typescript') {
      let js: string
      try { js = transpileTS(code) }
      catch (e) {
        partial = { stdout: '', stderr: `TypeScript error: ${e instanceof Error ? e.message : e}`, exitCode: 1 }
        return Response.json({ ...partial, language, runtime: Date.now() - t0 } satisfies RunResult)
      }
      partial = runInVm(js)

    } else {
      // ── Proxy to Railway for Python, Java, Go, C, C++, Rust, Bash ──
      // Railway has no serverless timeout limit → can wait for compilation
      const railRes = await fetch(`${RAILWAY_URL}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
        signal: AbortSignal.timeout(9000),  // stay within Vercel 10s limit
      })

      if (!railRes.ok) {
        partial = { stdout: '', stderr: `Execution proxy error: HTTP ${railRes.status}`, exitCode: 1 }
      } else {
        const data = await railRes.json()
        return Response.json(data)  // Railway already returns full RunResult
      }
    }
  } catch (err) {
    console.error('[api/run]', err)
    partial = {
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Execution error',
      exitCode: 1,
    }
  }

  return Response.json({ ...partial, language, runtime: Date.now() - t0 } satisfies RunResult)
}

// Suppress unused import warning
void LOCAL_LANGS
