import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { question, code, language, sessionId, viewerName } = await request.json()

    if (!question?.trim()) {
      return Response.json({ error: 'Missing question' }, { status: 400 })
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

    const codeContext = code?.trim()
      ? `Current code being written:\n\`\`\`${language ?? 'typescript'}\n${code.slice(0, 3000)}\n\`\`\``
      : 'No code context available yet.'

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a helpful coding instructor answering viewer questions during a live coding session.
The host is writing code in real-time and viewers can ask questions about it.
Be concise (3-4 sentences max), practical, and educational. Focus on explaining WHY.`,
        },
        {
          role: 'user',
          content: `${codeContext}\n\nViewer question from ${viewerName ?? 'guest'}: "${question}"`,
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
    })

    const answer = response.choices[0].message.content ?? 'Could not generate an answer.'

    return Response.json({ answer, question, viewerName, sessionId })
  } catch (err) {
    console.error('[/api/qa]', err)
    return Response.json({ error: 'Q&A failed', detail: String(err) }, { status: 500 })
  }
}
