/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest } from 'next/server'
import * as vm from 'vm'

export const dynamic = 'force-dynamic'

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  language: string
  runtime: number
}

type PartialResult = Omit<RunResult, 'language' | 'runtime'>

// ── helpers ───────────────────────────────────────────────────
function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function runInVm(js: string): PartialResult {
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

// ── main handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { code, language } = await req.json() as { code: string; language: string }

  if (!code?.trim()) {
    return Response.json({ error: 'No code provided' }, { status: 400 })
  }

  const t0 = Date.now()
  let partial: PartialResult

  try {
    if (language === 'javascript') {
      partial = runInVm(code)

    } else if (language === 'typescript') {
      let js: string
      try { js = transpileTS(code) } catch (e) {
        partial = { stdout: '', stderr: `TypeScript error: ${e instanceof Error ? e.message : e}`, exitCode: 1 }
        return Response.json({ ...partial, language, runtime: Date.now() - t0 } satisfies RunResult)
      }
      partial = runInVm(js)

    } else {
      // Other languages (Python, Java, Go, C, C++, Rust, Bash) need a compiler
      // not available in the serverless environment
      partial = {
        stdout: '',
        stderr: [
          `⚠ ${language} execution requires a compiler not available in this environment.`,
          ``,
          `  ✓ Supported for execution: JavaScript, TypeScript`,
          `  → Switch language to TypeScript or JavaScript to use the Run panel.`,
        ].join('\n'),
        exitCode: 1,
      }
    }
  } catch (err) {
    console.error('[api/run]', err)
    partial = { stdout: '', stderr: err instanceof Error ? err.message : 'Execution error', exitCode: 1 }
  }

  return Response.json({ ...partial, language, runtime: Date.now() - t0 } satisfies RunResult)
}
