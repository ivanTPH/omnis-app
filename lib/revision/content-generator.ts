import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export interface RevisionTaskContent {
  title: string
  instructions: string
  structuredContent: object
  modelAnswer: string
  differentiationNotes: string
}

function fallbackContent(input: {
  studentName: string
  subject: string
  weakTopics: string[]
  taskType: string
  lessonTitle?: string
  objectives?: string[]
}): RevisionTaskContent {
  const topic = input.lessonTitle || input.weakTopics.slice(0, 2).join(' & ') || 'Key Topics'
  const objectives = input.objectives ?? []

  // Build 5 curriculum-mapped fallback questions when lessonTitle is available
  const questions = input.lessonTitle
    ? [
        { id: '1', question: `Recall two key points from "${input.lessonTitle}".`, bloomsLevel: 'remember',  objectiveIndex: 0, marks: 1, markScheme: 'Award 1 mark for any correct factual recall related to the lesson topic.', guidance: 'Think back to the lesson — what were the key facts?', writingFrame: 'Two key points are… First… Second…', guidancePrompts: ['What did you learn in this lesson?', 'What key facts stood out?'], modelAnswerBullets: ['Any accurate factual recall from the lesson earns the mark.'] },
        { id: '2', question: `Explain what you understand about ${objectives[1] ?? 'the main ideas'} from this topic.`, bloomsLevel: 'understand', objectiveIndex: 1, marks: 2, markScheme: 'Award 1 mark for a relevant point, 1 further mark for explanation or development.', guidance: 'Explain in your own words.', writingFrame: 'I understand that… This is because… This means that…', guidancePrompts: ['Use your own words', 'Try to add a reason or example'], modelAnswerBullets: ['A relevant point about the topic (1 mark)', 'An explanation or development of that point (1 mark)'] },
        { id: '3', question: `Apply your knowledge of "${input.lessonTitle}" to explain how this topic connects to what you have studied before.`, bloomsLevel: 'apply', objectiveIndex: 1, marks: 2, markScheme: 'Award 1 mark per developed connection, up to 2 marks.', guidance: 'Use examples from the lesson.', writingFrame: 'This connects to… because… Another link is… which shows…', guidancePrompts: ['Think about other topics you have studied', 'Use the word "connects" or "links to"'], modelAnswerBullets: ['One connection to prior knowledge with explanation (1 mark)', 'A second developed connection (1 mark)'] },
        { id: '4', question: `Analyse the significance of ${objectives[0] ?? 'the main theme'} in "${input.lessonTitle}". Refer to specific details.`, bloomsLevel: 'analyse', objectiveIndex: 0, marks: 3, markScheme: 'Award 1 mark for a relevant point. Award 2 further marks for detailed analysis with specific reference.', guidance: 'Use the word "because" or "this shows" to extend your analysis.', writingFrame: '… is significant because… The evidence for this is… This shows that…', guidancePrompts: ['Start with a point', 'Add evidence from the lesson', 'Explain what the evidence shows'], modelAnswerBullets: ['A clear relevant point (1 mark)', 'Specific detail or evidence (1 mark)', 'Analytical comment on significance (1 mark)'] },
        { id: '5', question: `To what extent do you agree that ${objectives[2] ?? 'the key concepts covered in this lesson are important'}? Justify your answer.`, bloomsLevel: 'evaluate', objectiveIndex: 2, marks: 2, markScheme: 'Award 1 mark for a clear judgement. Award 1 further mark for a supported reason.', guidance: 'Give a clear viewpoint and back it up with evidence.', writingFrame: 'I agree/disagree to a [large/limited] extent because… However… Overall I think…', guidancePrompts: ['State your view clearly', 'Give a reason to support it'], modelAnswerBullets: ['A clear judgement/stance (1 mark)', 'A justified reason with supporting evidence (1 mark)'] },
      ]
    : input.weakTopics.slice(0, 5).map((t, i) => ({
        id: String(i + 1),
        question: `Explain your understanding of: ${t}`,
        bloomsLevel: 'understand',
        objectiveIndex: 0,
        marks: 2,
        markScheme: 'Mark scheme to be added by teacher.',
        guidance: '',
        writingFrame: '',
        guidancePrompts: [] as string[],
        modelAnswerBullets: [] as string[],
      }))

  return {
    title: `${input.subject} Revision — ${topic}`,
    instructions: `Answer all 5 questions about "${topic}". Questions increase in difficulty. Total: 10 marks.`,
    structuredContent: {
      type: input.taskType,
      lessonTitle: input.lessonTitle ?? topic,
      objectives,
      questions,
    },
    modelAnswer: 'See individual question mark schemes above.',
    differentiationNotes: input.weakTopics.length > 0
      ? `Student needs support with: ${input.weakTopics.join(', ')}`
      : 'No specific weak areas identified.',
  }
}

export async function generateRevisionTask(input: {
  studentId:          string
  studentName:        string
  subject:            string
  yearGroup:          number
  weakTopics:         string[]
  strongTopics:       string[]
  taskType:           string
  sendAdaptations:    string[]
  ilpTargets:         string[]
  durationMins:       number
  bloomsLevel?:         string
  lessonTitle?:         string
  objectives?:          string[]
  allLessons?:          { title: string; objectives: string[] }[]
  preferredTypes?:      string[]
  bloomsProfile?:       string   // e.g. "strong at remember/understand, needs practice at analyse/evaluate"
  learningFormatNotes?: string
  additionalContext?:   string   // teacher-pasted source material for topics not covered in lessons
}): Promise<RevisionTaskContent> {
  console.log('[generateRevisionTask] lessons:', input.allLessons?.map(l => l.title), 'lessonTitle:', input.lessonTitle, 'weakTopics:', input.weakTopics)

  if (!process.env.ANTHROPIC_API_KEY) return fallbackContent(input)

  const multiLesson = (input.allLessons?.length ?? 0) > 1
  // Use || not ?? so empty strings fall through to the default
  const topic       = input.lessonTitle || input.weakTopics.slice(0, 2).join(' & ') || `${input.subject} Year ${input.yearGroup}`
  const objectives  = input.objectives ?? []
  const objList     = objectives.length > 0
    ? objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')
    : '1. Recall key knowledge\n2. Understand core concepts\n3. Apply and evaluate ideas'

  // Multi-lesson: list all lessons taught so questions span the full period
  const lessonsBlock = multiLesson
    ? `\nLessons taught this period (questions must cover all of these):\n${input.allLessons!.map((l, i) =>
        `${i + 1}. "${l.title}"${l.objectives?.length ? ` — objectives: ${l.objectives.join('; ')}` : ''}`
      ).join('\n')}`
    : ''

  const sendNote = input.sendAdaptations.length > 0
    ? `SEND adaptations required: ${input.sendAdaptations.join(', ')} — use simpler language, shorter sentences, provide sentence starters where helpful.`
    : ''

  const weakNote = input.weakTopics.length > 0
    ? `Student's weaker areas within this topic: ${input.weakTopics.join(', ')}`
    : ''

  const profileNote = [
    input.preferredTypes && input.preferredTypes.length > 0
      ? `This student performs best with ${input.preferredTypes.join(' and ')} tasks — favour this question style where possible.`
      : '',
    input.bloomsProfile
      ? `Bloom's profile: ${input.bloomsProfile}`
      : '',
    input.learningFormatNotes
      ? `Teacher notes on learning format: ${input.learningFormatNotes}`
      : '',
  ].filter(Boolean).join(' ')

  const topicLine = multiLesson
    ? `Topics covered: ${input.allLessons!.map(l => `"${l.title}"`).join(', ')}`
    : `Lesson topic: "${topic}"`

  const contextNote = input.additionalContext?.trim()
    ? `\nTeacher-provided source material for topics not in class lessons:\n${input.additionalContext}`
    : ''

  const userPrompt = `You are a UK secondary school teacher creating a structured revision task for ${input.studentName}.

${topicLine}
Subject: ${input.subject} (Year ${input.yearGroup})
${multiLesson ? lessonsBlock : `Learning objectives:\n${objList}`}
${weakNote ? `\n${weakNote}` : ''}
${sendNote ? `\n${sendNote}` : ''}
${profileNote ? `\nAdaptive learning profile: ${profileNote}` : ''}
${input.ilpTargets.length > 0 ? `\nILP targets to support: ${input.ilpTargets.join('; ')}` : ''}
${contextNote}

${multiLesson
  ? `Create EXACTLY 5 exam-style questions distributed across the lessons above (at least 1 question per lesson where possible):`
  : `Create EXACTLY 5 exam-style questions about "${topic}" using this difficulty progression:`}
- Q1 (1 mark):  Knowledge/Recall — test factual knowledge of the lesson content
- Q2 (2 marks): Understanding — ask the student to explain or describe a key concept
- Q3 (2 marks): Application — ask the student to use their knowledge in context
- Q4 (3 marks): Analysis — ask the student to analyse, compare or explore in depth
- Q5 (2 marks): Evaluation — ask the student to make and justify a judgement

Total marks: 10

Rules:
- Every question MUST be specifically about "${topic}" — never generic
- Use the learning objectives to anchor each question to curriculum content
- Each question needs a detailed markScheme showing exactly what earns each mark
- Map each question to one of the learning objectives using objectiveIndex (0, 1, or 2)

Return ONLY a valid JSON object with exactly this structure:
{
  "title": "specific title referencing the lesson topic(s)",
  "instructions": "Answer all 5 questions. Questions increase in difficulty. Total: 10 marks.",
  "structuredContent": {
    "type": "${input.taskType}",
    "lessonTitle": "${multiLesson ? input.allLessons!.map(l => l.title).join(', ') : topic}",
    "objectives": ${JSON.stringify(objectives.length > 0 ? objectives : ['Recall key knowledge', 'Understand core concepts', 'Evaluate and apply ideas'])},
    "questions": [
      {"id":"1","question":"...","lessonTitle":"the lesson title this question is from","bloomsLevel":"remember","objectiveIndex":0,"marks":1,"markScheme":"Award 1 mark for...","guidance":"brief hint shown to student","writingFrame":"A sentence starter or structural scaffold, e.g. 'Two key points are…'","guidancePrompts":["Prompt shown while student writes","Second prompt if helpful"],"modelAnswerBullets":["Key point that earns this mark"]},
      {"id":"2","question":"...","lessonTitle":"...","bloomsLevel":"understand","objectiveIndex":1,"marks":2,"markScheme":"Award 1 mark for... Award a further mark for...","guidance":"brief hint","writingFrame":"I understand that… This is because…","guidancePrompts":["Use your own words","Add a reason or example"],"modelAnswerBullets":["Mark 1 — what earns it","Mark 2 — what earns it"]},
      {"id":"3","question":"...","lessonTitle":"...","bloomsLevel":"apply","objectiveIndex":1,"marks":2,"markScheme":"Award 1 mark per valid point, up to 2 marks.","guidance":"brief hint","writingFrame":"This connects to… because…","guidancePrompts":["Think about other topics","Use the word 'because'"],"modelAnswerBullets":["Mark 1","Mark 2"]},
      {"id":"4","question":"...","lessonTitle":"...","bloomsLevel":"analyse","objectiveIndex":0,"marks":3,"markScheme":"Award 1 mark for... 2 marks for... 3 marks for...","guidance":"brief hint","writingFrame":"… is significant because… The evidence for this is… This shows that…","guidancePrompts":["Start with a point","Add evidence","Explain what it shows"],"modelAnswerBullets":["Mark 1","Mark 2","Mark 3"]},
      {"id":"5","question":"...","lessonTitle":"...","bloomsLevel":"evaluate","objectiveIndex":2,"marks":2,"markScheme":"Award 1 mark for a clear judgement. Award 1 further mark for a justified reason.","guidance":"brief hint","writingFrame":"I agree/disagree to a [large/limited] extent because… Overall…","guidancePrompts":["State your view clearly","Give a reason to support it"],"modelAnswerBullets":["Clear judgement (1 mark)","Justified reason (1 mark)"]}
    ]
  },
  "modelAnswer": "Full combined mark scheme for teacher reference.",
  "differentiationNotes": "Notes on adaptations applied."
}`

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 2500,
      system:     'You are a UK secondary school teacher creating curriculum-mapped revision tasks. Every question must be specifically about the named lesson topic — never generic. Return ONLY valid JSON with no markdown fences.',
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const raw     = (response.content[0] as any)?.text ?? ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed  = JSON.parse(cleaned)

    return {
      title:                parsed.title                ?? fallbackContent(input).title,
      instructions:         parsed.instructions         ?? fallbackContent(input).instructions,
      structuredContent:    parsed.structuredContent    ?? fallbackContent(input).structuredContent,
      modelAnswer:          parsed.modelAnswer          ?? '',
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

  const allTopicsStr    = input.allTopics.join(', ')
    ? input.focusTopics.join(', ')
    : 'None identified — produce standard revision for all topics'
  const focusReasonsStr = input.focusReasons.join('\n- ')
  const sendStr         = input.sendAdaptations.length > 0
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
