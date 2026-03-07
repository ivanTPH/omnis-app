import Anthropic from '@anthropic-ai/sdk'

export type ReviewResult = {
  score: number
  suggestions: string[]
}

const FALLBACK_SCORES: Record<string, number> = {
  PLAN: 7, SLIDES: 6, WORKSHEET: 8, VIDEO: 8, LINK: 7, OTHER: 5,
}

function fallbackScore(type: string): ReviewResult {
  const score = FALLBACK_SCORES[type] ?? 60
  return {
    score,
    suggestions: [
      'Ensure font size is at least 14pt for readability',
      'Use high-contrast colours (minimum 4.5:1 ratio)',
      'Include a glossary of subject-specific vocabulary',
      'Break content into clearly labelled sections with headings',
    ],
  }
}

export async function reviewResource({
  label,
  type,
  url,
  description,
}: {
  label: string
  type: string
  url?: string
  description?: string
}): Promise<ReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return fallbackScore(type)

  try {
    const client = new Anthropic({ apiKey })

    const contextLines: string[] = [
      `Resource type: ${type}`,
      `Title / label: "${label}"`,
    ]
    if (url) contextLines.push(`URL: ${url}`)
    if (description) contextLines.push(`Description provided by teacher: "${description}"`)

    const prompt = `You are an expert in SEND (Special Educational Needs and Disabilities) educational best practice in UK secondary schools.

A teacher has added the following resource to their lesson:
${contextLines.join('\n')}

Score this resource from 1 to 10 for SEND accessibility using these criteria:
- Structure & layout (clear headings, numbered steps, bullet points)
- Dyslexia-friendly design (font choice, line spacing, colour contrast, text density)
- Visual support (use of images, diagrams, colour coding, icons)
- Language accessibility (reading level appropriate, jargon explained)
- Scaffolding & differentiation (worked examples, sentence starters, writing frames)
- Multiple means of representation (text + visual + audio options)

Be realistic: a plain URL or unknown resource should score 5–7 unless there are strong signals. A well-known accessible source (BBC Bitesize, Oak National Academy) can score 8–9. A raw PowerPoint with no description should score around 5–6.

Respond ONLY with valid JSON (no markdown, no explanation):
{"score": <integer 1-10>, "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (message.content[0] as { type: string; text: string }).text.trim()
    const parsed = JSON.parse(text) as { score: number; suggestions: string[] }

    return {
      score: Math.max(1, Math.min(10, Math.round(parsed.score))),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [],
    }
  } catch {
    return fallbackScore(type)
  }
}
