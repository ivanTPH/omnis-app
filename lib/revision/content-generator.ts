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

// ── generateYearRevisionTask ───────────────────────────────────────────────────

export interface YearRevisionContent {
  instructions:      string
  structuredContent: {
    type:         'year_revision'
    genericGuide: {
      topics: {
        name:          string
        keyFacts:      string[]
        vocabulary:    { term: string; definition: string }[]
        examQuestions: { question: string; markScheme: string; marks: number }[]
      }[]
    }
    focusAreas: {
      topics: {
        name:              string
        reason:            string
        practiceQuestions: { question: string; markScheme: string; marks: number }[]
      }[]
    }
  }
}

function fallbackYearContent(input: {
  studentName: string; subject: string; allTopics: string[]; focusTopics: string[]
}): YearRevisionContent {
  return {
    instructions: `Review the revision guide for all topics covered this year in ${input.subject}, then complete the practice questions in your Focus Areas.`,
    structuredContent: {
      type: 'year_revision',
      genericGuide: {
        topics: input.allTopics.map(name => ({
          name,
          keyFacts:      [`Key facts for ${name} will be added here.`],
          vocabulary:    [{ term: 'Key term', definition: 'Definition to be added.' }],
          examQuestions: [{ question: `Describe the key features of ${name}.`, markScheme: 'Mark scheme to be added.', marks: 4 }],
        })),
      },
      focusAreas: {
        topics: input.focusTopics.map(name => ({
          name,
          reason:            `Practice more on ${name}.`,
          practiceQuestions: [{ question: `Explain the significance of ${name}.`, markScheme: 'Mark scheme to be added.', marks: 3 }],
        })),
      },
    },
  }
}

export async function generateYearRevisionTask(input: {
  studentName:     string
  subject:         string
  yearGroup:       number
  allTopics:       string[]
  focusTopics:     string[]
  focusReasons:    string[]
  sendAdaptations: string[]
}): Promise<YearRevisionContent> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackYearContent(input)

  const allTopicsStr   = input.allTopics.join(', ')
  const focusStr       = input.focusTopics.length > 0
    ? input.focusTopics.join(', ')
    : 'None identified — produce standard revision for all topics'
  const focusReasonsStr = input.focusReasons.join('\n- ')
  const sendStr        = input.sendAdaptations.length > 0
    ? `Apply SEND adaptations: ${input.sendAdaptations.join(', ')} (simpler language, shorter sentences, bullet points)`
    : 'Standard language'

  const prompt = `Create a Year Revision resource for ${input.studentName} (Year ${input.yearGroup} ${input.subject}).

ALL TOPICS covered this year: ${allTopicsStr}

FOCUS AREAS (student performed below class average or below predicted grade):
- ${focusReasonsStr || 'None'}

SEND: ${sendStr}

Return ONLY a JSON object matching this exact structure:
{
  "instructions": "2-sentence student-facing instructions covering how to use the guide and focus areas",
  "structuredContent": {
    "type": "year_revision",
    "genericGuide": {
      "topics": [
        {
          "name": "<topic name>",
          "keyFacts": ["3-5 concise bullet-point facts"],
          "vocabulary": [{"term": "...", "definition": "..."}],
          "examQuestions": [{"question": "...", "markScheme": "...", "marks": 4}]
        }
      ]
    },
    "focusAreas": {
      "topics": [
        {
          "name": "<topic name>",
          "reason": "<student-friendly explanation of why this is a focus>",
          "practiceQuestions": [{"question": "...", "markScheme": "...", "marks": 3}, {"question": "...", "markScheme": "...", "marks": 4}]
        }
      ]
    }
  }
}

Rules:
- Include ALL topics in genericGuide (every topic in the list)
- Only include topics from the FOCUS AREAS list in focusAreas.topics (may be empty array)
- Keep keyFacts concise (1 sentence each)
- Exam questions must be exam-style (not "what is X?" — use "Explain", "Analyse", "Evaluate")
- Mark schemes should reference specific content points`

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 8000,
      system:     'You are a UK secondary school teacher creating comprehensive year revision materials. Return ONLY valid JSON with no markdown fences.',
      messages:   [{ role: 'user', content: prompt }],
    })

    const raw     = (response.content[0] as any)?.text ?? ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed  = JSON.parse(cleaned)

    return {
      instructions:      parsed.instructions      ?? fallbackYearContent(input).instructions,
      structuredContent: parsed.structuredContent ?? fallbackYearContent(input).structuredContent,
    }
  } catch (err) {
    console.error('[generateYearRevisionTask] AI error, using fallback:', err)
    return fallbackYearContent(input)
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
