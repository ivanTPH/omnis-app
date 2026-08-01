/**
 * demo-generate.ts — Stage 1 Agentic Demo Seed
 *
 * Runs after `npm run db:seed` to populate the demo with:
 *   1. AI-generated HTML lesson slides for all 10 demo lessons
 *   2. MCQ homework for 3 historical weeks × 3 English classes (9 assignments)
 *   3. Realistic student submissions driven by SEND-aware grade profiles
 *   4. Auto-marked scores (pure maths — no extra API calls for MCQ)
 *   5. StudentLearningProfile workingAtGrade set per student
 *
 * Usage:  npm run demo:generate
 *
 * Idempotent: safe to re-run — checks before creating.
 * Estimated cost: ~$1.50–2.50 in Anthropic API calls.
 * Estimated run time: 4–8 minutes.
 */

import { PrismaClient, HomeworkStatus, SubmissionStatus } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Helpers ───────────────────────────────────────────────────────────────────

function monday(offsetWeeks = 0): Date {
  const now = new Date()
  const dow = now.getDay()
  const d = new Date(now)
  if (dow === 6) d.setDate(now.getDate() + 2)
  else if (dow === 0) d.setDate(now.getDate() + 1)
  else d.setDate(now.getDate() - (dow - 1))
  d.setDate(d.getDate() + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/** Deterministic score: same student+homework always gives same result */
function studentScore(grade: number, numQuestions: number, seedStr: string): number {
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = ((h << 5) - h + seedStr.charCodeAt(i)) | 0
  const jitter = (Math.abs(Math.sin(h)) - 0.5) * 0.15
  const accuracy = Math.max(0.05, Math.min(0.98, 0.08 + (grade / 9) * 0.87 + jitter))
  return Math.max(0, Math.min(numQuestions, Math.round(accuracy * numQuestions)))
}

function pctToGcse(score: number, max: number): number {
  const pct = max > 0 ? (score / max) * 100 : 0
  if (pct >= 90) return 9
  if (pct >= 80) return 8
  if (pct >= 70) return 7
  if (pct >= 60) return 6
  if (pct >= 50) return 5
  if (pct >= 40) return 4
  if (pct >= 30) return 3
  if (pct >= 20) return 2
  return 1
}

// ── Student grade profiles ────────────────────────────────────────────────────
// Grade (1-9) reflects typical attainment; SEND students set appropriately.

const STUDENT_GRADES: Record<string, number> = {
  // 9E/En1 — Year 9 English
  'a.hughes@students.omnisdemo.school':  6,
  'm.johnson@students.omnisdemo.school': 7,
  't.cooper@students.omnisdemo.school':  5,
  'a.osei@students.omnisdemo.school':    8,
  'f.jenkins@students.omnisdemo.school': 6,
  'r.sharma@students.omnisdemo.school':  4,
  'b.walsh@students.omnisdemo.school':   7,
  's.ahmed@students.omnisdemo.school':   5,
  's.chen@students.omnisdemo.school':    5,  // SEN Support — SpLD/Dyslexia
  'm.bell@students.omnisdemo.school':    3,  // SEN Support — SEMH (inconsistent)
  'k.murphy@students.omnisdemo.school':  6,
  'f.alamin@students.omnisdemo.school':  4,  // SEN Support — Speech, Language & Comm
  // 10E/En2 — Year 10 English
  'o.thompson@students.omnisdemo.school': 7,
  'c.williams@students.omnisdemo.school': 8,
  'j.brown@students.omnisdemo.school':    5,
  'e.davies@students.omnisdemo.school':   7,
  'l.ahmed@students.omnisdemo.school':    6,
  'z.king@students.omnisdemo.school':     8,
  'n.clarke@students.omnisdemo.school':   6,
  'd.mwangi@students.omnisdemo.school':   5,
  'r.ferretti@students.omnisdemo.school': 5,  // EHCP — SpLD
  'a.walsh@students.omnisdemo.school':    3,  // SEN Support — SEMH
  // 11E/En1 — Year 11 English
  'g.wilson@students.omnisdemo.school':   8,
  'j.robinson@students.omnisdemo.school': 6,
  'i.moore@students.omnisdemo.school':    7,
  'e.clarke@students.omnisdemo.school':   5,
  'p.taylor@students.omnisdemo.school':   7,
  'n.martin@students.omnisdemo.school':   6,
  'a.patel@students.omnisdemo.school':    5,
  'b.hartley@students.omnisdemo.school':  7,
  'c.fox@students.omnisdemo.school':      4,  // EHCP — Communication & Interaction
  'm.torres@students.omnisdemo.school':   3,  // SEN Support — Cognition & Learning
}

// ── Lesson slide specs (10 lessons) ──────────────────────────────────────────

const LESSON_SLIDE_SPECS = [
  { id: 'demo-lesson-9E-d0-h9',   title: 'An Inspector Calls — Act 1 Introduction',      subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls', objectives: ['Understand the social and historical context', "Identify Priestley's messages about social responsibility", "Analyse the Inspector's dramatic arrival"] },
  { id: 'demo-lesson-10E-d0-h11', title: 'Macbeth — Ambition and Power',                  subject: 'English Literature', yearGroup: 10, topic: 'Macbeth',            objectives: ['Explore how Shakespeare presents ambition as destructive', 'Analyse key soliloquies from Acts 1 and 2', 'Develop PEE paragraphs with textual evidence'] },
  { id: 'demo-lesson-11E-d1-h10', title: 'Paper 1 Unseen Fiction Practice',               subject: 'English Language',   yearGroup: 11, topic: 'AQA Paper 1',        objectives: ['Apply Paper 1 Q4 skills to unseen extract', 'Structure a 20-mark response under timed conditions', 'Peer-assess using mark scheme descriptors'] },
  { id: 'demo-lesson-9E-d2-h9',   title: 'An Inspector Calls — Character Study',          subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls', objectives: ['Trace character development across the play', 'Compare generational attitudes to responsibility', 'Write a structured character analysis paragraph'] },
  { id: 'demo-lesson-11E-d2-h13', title: 'Paper 2 Non-Fiction — Language Analysis',       subject: 'English Language',   yearGroup: 11, topic: 'AQA Paper 2',        objectives: ['Identify language techniques in non-fiction', "Compare writers' perspectives using subject terminology", 'Plan and write a Q4 comparative response'] },
  { id: 'demo-lesson-10E-d3-h11', title: 'Macbeth — Soliloquy Analysis',                  subject: 'English Literature', yearGroup: 10, topic: 'Macbeth',            objectives: ['"Is this a dagger" and "Tomorrow" close-read', 'Explore how soliloquy reveals inner conflict', 'Practise A-grade analysis using context and language'] },
  { id: 'demo-lesson-9E-d4-h14',  title: 'An Inspector Calls — Responsibility Theme',     subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls', objectives: ['Evaluate how Priestley uses characters to explore responsibility', 'Write a timed response to an exam-style question', 'Self-assess using GCSE mark scheme'] },
  { id: 'demo-future-9E-d0',  title: 'An Inspector Calls — Essay Planning',  subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls', objectives: ['Plan a high-band essay response', 'Select and embed quotations effectively', 'Structure an argument for a 30-mark essay'] },
  { id: 'demo-future-10E-d1', title: 'Macbeth — Key Quotations Review',      subject: 'English Literature', yearGroup: 10, topic: 'Macbeth',            objectives: ['Identify and memorise key quotations per theme', 'Practise embedding quotes in analysis paragraphs', 'Evaluate quotation choice for exam conditions'] },
  { id: 'demo-future-11E-d2', title: 'Mock Exam Paper 1 — Timed Practice',  subject: 'English Language',   yearGroup: 11, topic: 'AQA Paper 1',        objectives: ['Complete a full Paper 1 under timed conditions', 'Apply learned strategies across all four questions', 'Reflect on performance and identify improvements'] },
]

// ── Historical homework (3 weeks × 3 English classes) ────────────────────────

const HISTORICAL_HOMEWORK = [
  // 9E/En1 — An Inspector Calls
  { classId: 'demo-class-9E-En1',  weekOffset: -3, title: 'AIC — Social Class and the Birling Family',   topic: 'An Inspector Calls: social hierarchy and the Birling family in Edwardian Britain', subject: 'English Literature', yearGroup: 9,  examBoard: 'AQA' },
  { classId: 'demo-class-9E-En1',  weekOffset: -2, title: "AIC — Priestley's Socialist Message",          topic: "How Priestley uses the play to critique capitalism and promote collective social responsibility", subject: 'English Literature', yearGroup: 9,  examBoard: 'AQA' },
  { classId: 'demo-class-9E-En1',  weekOffset: -1, title: 'AIC — Language and Dramatic Techniques',       topic: "Priestley's use of dramatic techniques: stage directions, dialogue, and the Inspector's interrogative language", subject: 'English Literature', yearGroup: 9,  examBoard: 'AQA' },
  // 10E/En2 — Macbeth
  { classId: 'demo-class-10E-En2', weekOffset: -3, title: 'Macbeth — Power and the Divine Right of Kings', topic: 'Jacobean beliefs about kingship, the divine right of kings, and the Great Chain of Being in Macbeth', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA' },
  { classId: 'demo-class-10E-En2', weekOffset: -2, title: "Macbeth — Lady Macbeth's Character and Role",  topic: "Lady Macbeth's ambition, her manipulation of Macbeth, and how Shakespeare presents gender roles", subject: 'English Literature', yearGroup: 10, examBoard: 'AQA' },
  { classId: 'demo-class-10E-En2', weekOffset: -1, title: 'Macbeth — The Supernatural and the Witches',   topic: 'The role of the three witches, prophecy, and the supernatural as a dramatic device in Macbeth', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA' },
  // 11E/En1 — English Language Paper 1
  { classId: 'demo-class-11E-En1', weekOffset: -3, title: 'Paper 1 — Creative Writing Craft',             topic: 'Narrative and descriptive writing: structure, narrative voice, and linguistic techniques for AQA Paper 1 Section B', subject: 'English Language', yearGroup: 11, examBoard: 'AQA' },
  { classId: 'demo-class-11E-En1', weekOffset: -2, title: 'Paper 1 — Language Techniques (Q2)',           topic: "AQA Paper 1 Q2: identifying and analysing a writer's use of language in unseen fiction extracts", subject: 'English Language', yearGroup: 11, examBoard: 'AQA' },
  { classId: 'demo-class-11E-En1', weekOffset: -1, title: 'Paper 1 — Evaluating a Text (Q4)',             topic: 'AQA Paper 1 Q4: evaluating how successfully a writer achieves their intended effect, with reference to the whole text', subject: 'English Language', yearGroup: 11, examBoard: 'AQA' },
]

type McqQuestion = {
  id: string
  question: string
  options: string[]
  correct: string
  marks: number
  scaffolding_hint: string
  ehcp_adaptation: string
}

// ── Phase 1: AI HTML lesson slides ───────────────────────────────────────────

async function generateHtmlSlides(spec: typeof LESSON_SLIDE_SPECS[0]): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: `You are an expert UK secondary school teacher. Create professional lesson slides as a single self-contained HTML page.
Use clean design: white background, blue accents (#1d4ed8), clear sans-serif typography (Arial/Helvetica).
Each slide is a full-width section separated by a horizontal rule. Inline CSS only — no external links, no JavaScript.
Make content educationally rigorous and curriculum-appropriate.`,
    messages: [{
      role: 'user',
      content: `Create lesson slides for:
Title: ${spec.title}
Subject: ${spec.subject}, Year ${spec.yearGroup}, AQA Exam Board
Topic: ${spec.topic}
Learning Objectives:
${spec.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Include these 6 slides:
1. Title slide (title, learning objectives, date: "Term 1 2025-26")
2. Starter activity (retrieval question or engaging hook — 3 minutes)
3. Key Knowledge (main content: key facts, quotes, or concepts — include at least one direct quote or example)
4. Deeper Analysis (worked example or analytical explanation)
5. Your Task (exam-style question with success criteria)
6. Plenary (3 key takeaways + homework reminder)

Return complete, valid HTML. No markdown, no code fences — pure HTML starting with <!DOCTYPE html>.`,
    }],
  })

  const html = (msg.content[0] as any).text as string
  const cleaned = html.replace(/^```html?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  return Buffer.from(cleaned).toString('base64')
}

async function phase1_lessonResources(schoolId: string, teacherId: string): Promise<void> {
  console.log('\n📚 Phase 1: Generating AI lesson slides...')

  for (const spec of LESSON_SLIDE_SPECS) {
    const existing = await prisma.resource.findFirst({
      where: { lessonId: spec.id, isAiGenerated: true, type: 'SLIDES' },
      select: { id: true },
    })
    if (existing) {
      console.log(`  ✓ ${spec.title} — AI slides already exist`)
      continue
    }

    const lesson = await prisma.lesson.findUnique({ where: { id: spec.id }, select: { id: true } })
    if (!lesson) {
      console.log(`  ⚠ Lesson ${spec.id} not found — skipping`)
      continue
    }

    process.stdout.write(`  ⟳ ${spec.title}...`)
    try {
      const b64 = await generateHtmlSlides(spec)
      await prisma.resource.create({
        data: {
          schoolId,
          lessonId:      spec.id,
          type:          'SLIDES',
          label:         `${spec.title} — AI Lesson Slides`,
          url:           `data:text/html;base64,${b64}`,
          isAiGenerated: true,
          createdBy:     teacherId,
        },
      })
      console.log(' ✓')
    } catch (err) {
      console.log(` ✗ ${err}`)
    }
    await sleep(500)
  }
}

// ── Phase 2: Historical MCQ homework ─────────────────────────────────────────

// Pre-written fallback questions for topics where Claude consistently mis-encodes JSON.
// Used only when all 3 API attempts fail.
const FALLBACK_QUESTIONS: Record<string, McqQuestion[]> = {
  'Paper 1 — Language Techniques (Q2)': [
    { id: 'q1', question: 'In AQA Paper 1 Q2, which technique attributes human qualities to non-human things?', options: ['Metaphor', 'Personification', 'Alliteration', 'Onomatopoeia'], correct: 'Personification', marks: 1, scaffolding_hint: 'Think about which technique gives human characteristics to objects or nature.', ehcp_adaptation: 'Things acting like people = personification.' },
    { id: 'q2', question: 'What does the term semantic field mean in language analysis?', options: ['A group of words related by topic or theme', 'Words that sound similar', 'Words with opposite meanings', 'Words borrowed from another language'], correct: 'A group of words related by topic or theme', marks: 1, scaffolding_hint: 'Semantic relates to meaning. Think: what kind of group of words shares a theme?', ehcp_adaptation: 'Semantic field = words that all relate to the same idea, e.g. words about water.' },
    { id: 'q3', question: 'How many marks is AQA Paper 1 Q2 worth and approximately how long should you spend on it?', options: ['4 marks, 5 minutes', '8 marks, 10 minutes', '8 marks, 20 minutes', '16 marks, 30 minutes'], correct: '8 marks, 10 minutes', marks: 1, scaffolding_hint: 'Check the AQA Paper 1 mark allocation. The question focuses on a specific extract.', ehcp_adaptation: 'Q2 = 8 marks. Roughly 1 mark per minute plus planning time.' },
    { id: 'q4', question: 'Which of the following best explains the effect of short sentences in a fiction extract?', options: ['They confuse the reader', 'They slow the pace and create a reflective tone', 'They create tension and urgency', 'They show the character is educated'], correct: 'They create tension and urgency', marks: 1, scaffolding_hint: 'Think about how sentence length affects the pace of reading.', ehcp_adaptation: 'Short sentences = fast pace = tension or excitement for the reader.' },
    { id: 'q5', question: 'What does the term connotation mean in the context of language analysis?', options: ['The dictionary definition of a word', 'The associations or ideas a word suggests beyond its literal meaning', 'A word that sounds like what it describes', 'A comparison using like or as'], correct: 'The associations or ideas a word suggests beyond its literal meaning', marks: 1, scaffolding_hint: 'Denotation = literal meaning. What does the word suggest or imply beyond that?', ehcp_adaptation: 'Connotation = the feelings or ideas a word brings to mind, e.g. crimson suggests danger.' },
  ],
}

function parseJsonSafely(raw: string): McqQuestion[] {
  let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  const m = s.match(/\{[\s\S]*\}/)
  if (m) s = m[0]
  try { return (JSON.parse(s) as any).questions } catch { /* fall through */ }
  // Escape raw newlines inside JSON strings
  s = s.replace(/"([^"]*)"/g, (_: string, inner: string) => `"${inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`)
  return (JSON.parse(s) as any).questions
}

async function generateMcqQuestions(hw: typeof HISTORICAL_HOMEWORK[0]): Promise<McqQuestion[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: `You are an expert ${hw.examBoard} ${hw.subject} teacher for Year ${hw.yearGroup}. Return ONLY a valid JSON object — no prose, no code fences, no markdown. All string values must be on a single line with no line breaks.`,
        messages: [{
          role: 'user',
          content: `Generate 5 multiple-choice questions on: "${hw.topic}".
Each question: 4 options (one correct, three plausible distractors), a scaffolding_hint, and an ehcp_adaptation.
All field values must be plain strings on one line — no newlines inside JSON string values.

Return ONLY this exact JSON structure:
{"questions":[{"id":"q1","question":"...","options":["A","B","C","D"],"correct":"A","marks":1,"scaffolding_hint":"...","ehcp_adaptation":"..."},{"id":"q2","question":"...","options":["A","B","C","D"],"correct":"B","marks":1,"scaffolding_hint":"...","ehcp_adaptation":"..."},{"id":"q3","question":"...","options":["A","B","C","D"],"correct":"C","marks":1,"scaffolding_hint":"...","ehcp_adaptation":"..."},{"id":"q4","question":"...","options":["A","B","C","D"],"correct":"D","marks":1,"scaffolding_hint":"...","ehcp_adaptation":"..."},{"id":"q5","question":"...","options":["A","B","C","D"],"correct":"A","marks":1,"scaffolding_hint":"...","ehcp_adaptation":"..."}]}`,
        }],
      })
      const raw = (msg.content[0] as any).text as string
      const questions = parseJsonSafely(raw)
      if (Array.isArray(questions) && questions.length > 0) return questions
      throw new Error('Empty questions array')
    } catch (err) {
      if (attempt === 3) {
        const fallback = FALLBACK_QUESTIONS[hw.title]
        if (fallback) {
          console.log(` (using fallback questions)`)
          return fallback
        }
        throw err
      }
      console.log(` (retry ${attempt})`)
      await sleep(1000)
    }
  }
  throw new Error('Failed after 3 attempts')
}

async function phase2_historicalHomework(schoolId: string, teacherId: string): Promise<Map<string, { hwId: string; questions: McqQuestion[] }>> {
  console.log('\n📝 Phase 2: Generating historical homework...')

  // Map: title → { hwId, questions }
  const result = new Map<string, { hwId: string; questions: McqQuestion[] }>()

  for (const hw of HISTORICAL_HOMEWORK) {
    const existing = await prisma.homework.findFirst({
      where: { classId: hw.classId, title: hw.title, schoolId },
      select: { id: true, structuredContent: true },
    })
    if (existing) {
      console.log(`  ✓ ${hw.title} — already exists`)
      const qs = (existing.structuredContent as any)?.questions as McqQuestion[] ?? []
      result.set(hw.title, { hwId: existing.id, questions: qs })
      continue
    }

    const dueAt = monday(hw.weekOffset)
    dueAt.setDate(dueAt.getDate() + 4)  // Friday
    dueAt.setHours(23, 59, 0, 0)

    process.stdout.write(`  ⟳ ${hw.title}...`)
    try {
      const questions = await generateMcqQuestions(hw)

      const homework = await prisma.homework.create({
        data: {
          schoolId,
          classId:             hw.classId,
          title:               hw.title,
          instructions:        `Answer all ${questions.length} questions on: ${hw.topic}. Choose the best answer for each.`,
          modelAnswer:         questions.map((q, i) => `Q${i + 1}: ${q.correct}`).join('\n'),
          dueAt,
          status:              HomeworkStatus.CLOSED,
          type:                'MCQ_QUIZ',
          createdBy:           teacherId,
          homeworkVariantType: 'multiple_choice',
          structuredContent:   { questions },
          learningObjectives:  [hw.topic],
          bloomsLevel:         'Remember',
          estimatedMins:       15,
        },
      })

      result.set(hw.title, { hwId: homework.id, questions })
      console.log(' ✓')
    } catch (err) {
      console.log(` ✗ ${err}`)
    }
    await sleep(500)
  }

  return result
}

// ── Phase 3: Student submissions ─────────────────────────────────────────────

async function phase3_studentSubmissions(
  schoolId: string,
  hwMap: Map<string, { hwId: string; questions: McqQuestion[] }>,
): Promise<void> {
  console.log('\n🎓 Phase 3: Generating student submissions...')

  let created = 0
  let skipped = 0

  for (const hw of HISTORICAL_HOMEWORK) {
    const entry = hwMap.get(hw.title)
    if (!entry?.questions?.length) continue

    const { hwId, questions } = entry

    // Fetch homework to get dueAt
    const hwRecord = await prisma.homework.findUnique({
      where: { id: hwId },
      select: { dueAt: true },
    })
    if (!hwRecord) continue

    // Get enrolled students
    const enrolments = await prisma.enrolment.findMany({
      where: { classId: hw.classId },
      select: { user: { select: { id: true, email: true } } },
    })

    for (const { user: student } of enrolments) {
      const exists = await prisma.submission.findFirst({
        where: { homeworkId: hwId, studentId: student.id },
        select: { id: true },
      })
      if (exists) { skipped++; continue }

      const grade = STUDENT_GRADES[student.email] ?? 5
      const numCorrect = studentScore(grade, questions.length, `${student.id}-${hwId}`)

      // Deterministic shuffle of which questions are answered correctly
      let h = 0
      for (const c of `${student.id}${hwId}`) h = ((h << 5) - h + c.charCodeAt(0)) | 0
      const indices = questions.map((_, i) => i)
      indices.sort((a, b) => Math.sin((h + a) * 13.7) - Math.sin((h + b) * 13.7))
      const correctSet = new Set(indices.slice(0, numCorrect))

      const answers = questions.map((q, i) => {
        if (correctSet.has(i)) return q.correct
        return q.options.find(o => o !== q.correct) ?? q.options[0]
      })

      const gcseGrade = pctToGcse(numCorrect, questions.length)

      const submittedAt = new Date(hwRecord.dueAt)
      submittedAt.setHours(submittedAt.getHours() - Math.floor(Math.abs(Math.sin(h)) * 16) - 2)

      const markedAt = new Date(hwRecord.dueAt)
      markedAt.setDate(markedAt.getDate() + 1)
      markedAt.setHours(9, 0, 0, 0)

      const feedback = gcseGrade >= 7
        ? `Well done — you scored ${numCorrect}/${questions.length}. Strong understanding of this topic. Keep using specific evidence in your answers.`
        : gcseGrade >= 5
        ? `Good effort. You scored ${numCorrect}/${questions.length}. Review the questions you missed — re-read your notes on this topic.`
        : `You scored ${numCorrect}/${questions.length}. This topic needs more revision. Use the scaffolding hints when you review your answers.`

      await prisma.submission.create({
        data: {
          schoolId,
          homeworkId:         hwId,
          studentId:          student.id,
          content:            '',           // required field; structured answers in structuredResponse
          status:             SubmissionStatus.RETURNED,
          structuredResponse: { answers },
          autoScore:          numCorrect,
          finalScore:         gcseGrade,    // stored as GCSE grade 1–9
          autoFeedback:       feedback,
          feedback,
          autoMarked:         true,
          teacherReviewed:    false,
          submittedAt,
          markedAt,
        },
      })
      created++
    }
  }

  console.log(`  ✓ Created ${created} submissions, skipped ${skipped} existing`)
}

// ── Phase 4: Set workingAtGrade on StudentLearningProfile ─────────────────────

async function phase4_learningProfiles(schoolId: string): Promise<void> {
  console.log('\n📊 Phase 4: Setting student working-at grades...')

  // Get all students in the English classes
  const classIds = ['demo-class-9E-En1', 'demo-class-10E-En2', 'demo-class-11E-En1']
  const enrolments = await prisma.enrolment.findMany({
    where: { classId: { in: classIds } },
    select: { userId: true },
    distinct: ['userId'],
  })

  let updated = 0
  for (const { userId } of enrolments) {
    const submissions = await prisma.submission.findMany({
      where: { studentId: userId, schoolId, finalScore: { not: null } },
      select: { finalScore: true },
    })
    if (!submissions.length) continue

    const avg = submissions.reduce((a, s) => a + s.finalScore!, 0) / submissions.length
    const workingAt = Math.max(1, Math.min(9, Math.round(avg)))
    const targetGrade = Math.min(9, workingAt + 1)

    await prisma.studentLearningProfile.upsert({
      where: { studentId: userId },
      update: {
        workingAtGrade: workingAt,
        targetGrade,
        lastUpdated: new Date(),
      },
      create: {
        studentId:    userId,
        schoolId,
        workingAtGrade: workingAt,
        targetGrade,
        preferredTypes:  [],
        strengthAreas:   [],
        developmentAreas: [],
        lastUpdated:     new Date(),
      },
    })
    updated++
  }

  console.log(`  ✓ Updated ${updated} student learning profiles`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Omnis Demo Generate — Stage 1')
  console.log('='.repeat(52))

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY not set in .env.local')
    process.exit(1)
  }

  const school = await prisma.school.findFirst({
    where: { OR: [{ wondeId: 'demo-school' }, { emailDomain: 'omnisdemo.school' }] },
    select: { id: true, name: true },
  })
  if (!school) {
    console.error('✗ Demo school not found — run `npm run db:seed` first')
    process.exit(1)
  }

  const teacher = await prisma.user.findFirst({
    where: { email: 'j.patel@omnisdemo.school' },
    select: { id: true },
  })
  if (!teacher) {
    console.error('✗ Demo teacher not found — run `npm run db:seed` first')
    process.exit(1)
  }

  console.log(`\n✓ Demo school: ${school.name}  (${school.id})`)
  console.log(`✓ Teacher:     j.patel  (${teacher.id})`)

  const t0 = Date.now()

  await phase1_lessonResources(school.id, teacher.id)

  const hwMap = await phase2_historicalHomework(school.id, teacher.id)

  await phase3_studentSubmissions(school.id, hwMap)

  await phase4_learningProfiles(school.id)

  const elapsed = Math.round((Date.now() - t0) / 1000)
  console.log('\n' + '='.repeat(52))
  console.log(`✅ Complete in ${elapsed}s`)
  console.log('\nWhat was generated:')
  console.log('  • AI HTML lesson slides for all 10 demo lessons')
  console.log('  • 9 historical MCQ homework assignments (3 weeks × 3 classes)')
  console.log('  • Student submissions with SEND-aware grade profiles')
  console.log('  • StudentLearningProfile workingAtGrade set for all students')
  console.log('\nNext:')
  console.log('  • Log in as j.patel@omnisdemo.school and open a lesson folder')
  console.log('  • Go to /analytics → Students to see grade distributions')
  console.log('  • COACH/QUALITY agents will process this data on their next nightly run')
  console.log('  • Or trigger manually: GET /api/cron/agent-coach (Bearer CRON_SECRET)')
}

main()
  .catch(e => { console.error('✗ Fatal:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
