/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest } from 'next/server'
import * as vm from 'vm'
import { execFile } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────
export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  language: string
  runtime: number
}

type PartialResult = Omit<RunResult, 'language' | 'runtime'>

// ── Helper: run code in Node.js vm (JS / transpiled TS) ────────
function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function runInVm(jsCode: string): PartialResult {
  const out: string[] = []
  const err: string[] = []

  const sandbox = {
    console: {
      log:   (...a: unknown[]) => out.push(a.map(stringify).join(' ')),
      error: (...a: unknown[]) => err.push(a.map(stringify).join(' ')),
      warn:  (...a: unknown[]) => out.push('[warn] ' + a.map(stringify).join(' ')),
      info:  (...a: unknown[]) => out.push(a.map(stringify).join(' ')),
    },
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    setTimeout: undefined,
    setInterval: undefined,
    fetch:       undefined,
    process:     undefined,
    global:      undefined,
    require:     undefined,
  }

  try {
    vm.runInNewContext(jsCode, sandbox, { timeout: 5000, filename: 'main.js' })
    return { stdout: out.join('\n'), stderr: err.join('\n'), exitCode: err.length ? 1 : 0 }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { stdout: out.join('\n'), stderr: msg, exitCode: 1 }
  }
}

// ── Helper: transpile TypeScript → JavaScript ───────────────────
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

// ── Helper: run code file with a process (Python, Bash) ─────────
function runProcess(
  executable: string,
  args: string[],
  code: string,
  ext: string,
): Promise<PartialResult> {
  return new Promise(async (resolve) => {
    const id    = crypto.randomUUID()
    const file  = join(tmpdir(), `cc_${id}.${ext}`)

    try {
      await writeFile(file, code, 'utf8')
    } catch {
      return resolve({ stdout: '', stderr: 'Could not write temp file', exitCode: 1 })
    }

    execFile(
      executable,
      [...args, file],
      { timeout: 8000, maxBuffer: 512 * 1024 },
      (err, stdout, stderr) => {
        unlink(file).catch(() => {})

        const exitCode = typeof err?.code === 'number' ? err.code : (err ? 1 : 0)
        let stderrOut = stderr ?? ''

        // Remove temp file path from error messages for cleaner output
        if (stderrOut) stderrOut = stderrOut.replaceAll(file, '<file>')

        resolve({ stdout: stdout ?? '', stderr: stderrOut, exitCode })
      },
    )
  })
}

// ── Helper: not supported in serverless env ─────────────────────
function unsupported(lang: string): PartialResult {
  return {
    stdout: '',
    stderr: [
      `⚠ ${lang} requires a compiler (javac, gcc, go, rustc) which is not`,
      `  available in the serverless environment.`,
      ``,
      `  Supported languages: JavaScript, TypeScript, Python, Bash`,
    ].join('\n'),
    exitCode: 1,
  }
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { code, language } = await req.json() as { code: string; language: string }

  if (!code?.trim()) {
    return Response.json({ error: 'No code provided' }, { status: 400 })
  }

  const t0 = Date.now()
  let partial: PartialResult

  try {
    switch (language) {
      case 'javascript':
        partial = runInVm(code)
        break

      case 'typescript': {
        let js: string
        try { js = transpileTS(code) } catch (e) {
          partial = { stdout: '', stderr: `TypeScript compile error: ${e instanceof Error ? e.message : e}`, exitCode: 1 }
          break
        }
        partial = runInVm(js)
        break
      }

      case 'python':
        partial = await runProcess('python3', [], code, 'py')
        break

      case 'bash':
        partial = await runProcess('/bin/bash', [], code, 'sh')
        break

      // Compiled languages — not available in serverless
      case 'java':   partial = unsupported('Java');   break
      case 'go':     partial = unsupported('Go');     break
      case 'c':      partial = unsupported('C');      break
      case 'cpp':    partial = unsupported('C++');    break
      case 'rust':   partial = unsupported('Rust');   break

      default:
        partial = { stdout: '', stderr: `Unknown language: ${language}`, exitCode: 1 }
    }
  } catch (err: unknown) {
    console.error('[api/run]', err)
    partial = { stdout: '', stderr: err instanceof Error ? err.message : 'Execution error', exitCode: 1 }
  }

  const result: RunResult = { ...partial, language, runtime: Date.now() - t0 }
  return Response.json(result)
}
