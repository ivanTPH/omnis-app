import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface RevisionTaskContent {
  title: string
  instructions: string
  structuredContent: object
  modelAnswer: string
  differentiationNotes: string
}

function fallbackContent(input: { studentName: string; subject: string; weakTopics: string[]; taskType: string }): RevisionTaskContent {
  return {
    title: `${input.subject} Revision — ${input.weakTopics.slice(0, 2).join(' & ') || 'Key Topics'}`,
    instructions: `Complete this ${input.taskType.replace(/_/g, ' ')} revision task focusing on the key topics from your recent lessons.`,
    structuredContent: {
      type: input.taskType,
      questions: input.weakTopics.slice(0, 3).map((topic, i) => ({
        id: String(i + 1),
        question: `Review your understanding of: ${topic}`,
        marks: 3,
      })),
    },
    modelAnswer: 'Model answer to be added by teacher.',
    differentiationNotes: input.weakTopics.length > 0
      ? `Student needs support with: ${input.weakTopics.join(', ')}`
      : 'No specific weak areas identified.',
  }
}

export async function generateRevisionTask(input: {
  studentId: string
  studentName: string
  subject: string
  yearGroup: number
  weakTopics: string[]
  strongTopics: string[]
  taskType: string
  sendAdaptations: string[]
  ilpTargets: string[]
  durationMins: number
  bloomsLevel?: string
}): Promise<RevisionTaskContent> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackContent(input)

  const schemaHint = taskTypeSchema(input.taskType)

  const userPrompt = `Create a personalised revision task for ${input.studentName}.

Subject: ${input.subject} (Year ${input.yearGroup})
Task type: ${input.taskType}
Duration: ${input.durationMins} minutes
Focus topics (student performed poorly): ${input.weakTopics.join(', ') || 'General revision'}
Strong topics (can include lightly): ${input.strongTopics.join(', ') || 'None'}
SEND adaptations needed: ${input.sendAdaptations.join(', ') || 'None'}
ILP targets to incorporate: ${input.ilpTargets.join('; ') || 'None'}
${input.bloomsLevel ? `Bloom's level: ${input.bloomsLevel}` : ''}

Generate content for this ${input.taskType} task. Weight 70% on focus (weak) topics, 30% on other content.

Return ONLY a JSON object with these fields:
- title: string (descriptive task title)
- instructions: string (clear student-facing instructions, 2-3 sentences)
- structuredContent: object (${schemaHint})
- modelAnswer: string (complete model answer / mark scheme)
- differentiationNotes: string (teacher notes on adaptations applied)`

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2000,
      system:     'You are a UK secondary school teacher creating personalised revision tasks. You focus on topics where the student has underperformed, using their preferred learning style and any required SEND adaptations. Return ONLY valid JSON with no markdown fences.',
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const raw = (response.content[0] as any)?.text ?? ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      title:                parsed.title ?? fallbackContent(input).title,
      instructions:         parsed.instructions ?? fallbackContent(input).instructions,
      structuredContent:    parsed.structuredContent ?? fallbackContent(input).structuredContent,
      modelAnswer:          parsed.modelAnswer ?? '',
      differentiationNotes: parsed.differentiationNotes ?? '',
    }
  } catch (err) {
    console.error('[generateRevisionTask] AI error, using fallback:', err)
    return fallbackContent(input)
  }
}

function taskTypeSchema(taskType: string): string {
  switch (taskType) {
    case 'quiz':
    case 'multiple_choice':
      return 'questions array: [{id, question, options:[{id,text}], correctOptionId, explanation}]'
    case 'short_answer':
    case 'retrieval_practice':
      return 'questions array: [{id, question, marks, guidance}]'
    case 'essay':
    case 'extended_writing':
      return '{prompt, wordCount, markScheme:{ao1,ao2,ao3}, planningPrompts:[]}'
    case 'mind_map':
      return '{centralConcept, branches:[{label, subpoints:[]}]}'
    default:
      return 'questions array: [{id, question, marks}]'
  }
}
