import Groq from 'groq-sdk'

// Simple line-level diff: finds the first changed region
export interface DiffResult {
  hasChanges: boolean
  addedLines: string[]
  removedLines: string[]
  changedLineNumbers: number[]
  snippet: string      // the key changed block (max 10 lines)
}

export function computeDiff(prev: string, curr: string): DiffResult {
  const prevLines = prev.split('\n')
  const currLines = curr.split('\n')

  const added: string[] = []
  const removed: string[] = []
  const changedNums: number[] = []

  const maxLen = Math.max(prevLines.length, currLines.length)

  for (let i = 0; i < maxLen; i++) {
    const p = prevLines[i] ?? ''
    const c = currLines[i] ?? ''
    if (p !== c) {
      changedNums.push(i + 1)
      if (c && !p) added.push(c)
      else if (p && !c) removed.push(p)
      else { removed.push(p); added.push(c) }
    }
  }

  // Grab a snippet around the first changed line (±4 lines)
  const firstChanged = changedNums[0] ?? 1
  const start = Math.max(0, firstChanged - 5)
  const end = Math.min(currLines.length, firstChanged + 5)
  const snippet = currLines.slice(start, end).join('\n')

  return {
    hasChanges: changedNums.length > 0,
    addedLines: added,
    removedLines: removed,
    changedLineNumbers: changedNums,
    snippet,
  }
}

// ── Types ─────────────────────────────────────────────────────
export interface Annotation {
  line: number
  explanation: string
  timestamp: number
  language: string
}

// ── Groq client (singleton) ───────────────────────────────────
let groqClient: Groq | null = null
function getGroq(): Groq {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groqClient
}

// ── Main annotate function ────────────────────────────────────
export async function annotateCode(
  code: string,
  diff: DiffResult,
  language: string
): Promise<Annotation> {
  const groq = getGroq()

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are a live coding instructor explaining code changes to viewers watching a live session. 
Be concise (2-3 sentences max). Focus on WHY the change was made, not just WHAT changed.
Respond ONLY with a valid JSON object in this exact format:
{"line": <number>, "explanation": "<string>"}

Where "line" is the most interesting changed line number, and "explanation" is your 2-3 sentence explanation.`,
      },
      {
        role: 'user',
        content: `Language: ${language}

Changed lines: ${diff.changedLineNumbers.join(', ')}

Code snippet around the change:
\`\`\`${language}
${diff.snippet}
\`\`\`

${diff.addedLines.length > 0 ? `Added:\n${diff.addedLines.map(l => `+ ${l}`).join('\n')}\n` : ''}
${diff.removedLines.length > 0 ? `Removed:\n${diff.removedLines.map(l => `- ${l}`).join('\n')}\n` : ''}

Full code context:
\`\`\`${language}
${code.slice(0, 2000)}
\`\`\``,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 200,
    temperature: 0.4,
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)

  return {
    line: Number(parsed.line) || diff.changedLineNumbers[0] || 1,
    explanation: String(parsed.explanation || 'Code updated.'),
    timestamp: Date.now(),
    language,
  }
}
