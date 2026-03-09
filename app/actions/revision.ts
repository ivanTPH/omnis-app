'use server'

import { auth }    from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma }  from '@/lib/prisma'
import Anthropic   from '@anthropic-ai/sdk'

// ─── Guard ────────────────────────────────────────────────────────────────────

async function requireStudent() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session.user as any
  if (u.role !== 'STUDENT') redirect('/student/dashboard')
  return u
}

// ─── Exam CRUD ────────────────────────────────────────────────────────────────

export async function getMyExams(studentId: string) {
  await requireStudent()
  return prisma.revisionExam.findMany({
    where:   { studentId },
    orderBy: { examDate: 'asc' },
    include: { sessions: { select: { id: true, status: true } } },
  })
}

export async function addExam(studentId: string, data: {
  subject:      string
  examBoard?:   string
  paperName?:   string
  examDate:     string   // ISO
  durationMins?: number
}) {
  await requireStudent()
  return prisma.revisionExam.create({
    data: {
      studentId,
      subject:      data.subject,
      examBoard:    data.examBoard  || null,
      paperName:    data.paperName  || null,
      examDate:     new Date(data.examDate),
      durationMins: data.durationMins ?? null,
    },
  })
}

export async function deleteExam(examId: string) {
  const user = await requireStudent()
  const exam = await prisma.revisionExam.findUnique({ where: { id: examId } })
  if (!exam || exam.studentId !== user.id) throw new Error('Not authorised')
  // cascade via schema relation
  await prisma.revisionSession.deleteMany({ where: { examId } })
  await prisma.revisionExam.delete({ where: { id: examId } })
}

// ─── Session queries ──────────────────────────────────────────────────────────

export async function getMyRevisionSessions(studentId: string, weekStart?: Date) {
  await requireStudent()

  // Default to current week Monday
  const monday = weekStart ? new Date(weekStart) : getMonday(new Date())
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const sessions = await prisma.revisionSession.findMany({
    where: {
      studentId,
      scheduledAt: { gte: monday, lte: sunday },
    },
    orderBy: { scheduledAt: 'asc' },
    include: { exam: { select: { subject: true, examBoard: true } } },
  })

  // Attach Oak lesson titles where slug present
  const slugs = sessions.map(s => s.oakLessonSlug).filter(Boolean) as string[]
  const oakLessons = slugs.length > 0
    ? await prisma.oakLesson.findMany({
        where: { slug: { in: slugs }, deletedAt: null },
        select: { slug: true, title: true },
      })
    : []
  const oakMap = new Map(oakLessons.map(l => [l.slug, l.title]))

  return sessions.map(s => ({
    ...s,
    oakLessonTitle: s.oakLessonSlug ? oakMap.get(s.oakLessonSlug) ?? null : null,
  }))
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

// ─── AI Plan Generation ───────────────────────────────────────────────────────

type GeneratedSession = {
  subject:     string
  topic:       string
  scheduledAt: string  // ISO
  durationMins: number
  examId:      string | null
}

export async function generateRevisionPlan(studentId: string, input: {
  examIds:            string[]
  weeksUntilExams:    number
  hoursPerDay:        number
  preferredSlots:     string[]
  confidenceRatings:  Record<string, number>
}): Promise<{ sessions: GeneratedSession[]; error?: string }> {
  await requireStudent()

  // Fetch exam details
  const exams = await prisma.revisionExam.findMany({
    where: { id: { in: input.examIds }, studentId },
    orderBy: { examDate: 'asc' },
  })

  const examLines = exams.map(e =>
    `- ${e.subject}${e.paperName ? ` (${e.paperName})` : ''} — ${e.examDate.toDateString()}${e.examBoard ? ` [${e.examBoard}]` : ''}`
  ).join('\n')

  const confLines = Object.entries(input.confidenceRatings)
    .map(([subj, c]) => `- ${subj}: ${c}/5`).join('\n')

  const userPrompt =
`Create a revision plan for a student with these exams:
${examLines}

Available study time: ${input.hoursPerDay} hours/day over ${input.weeksUntilExams} weeks
Preferred slots: ${input.preferredSlots.join(', ')}

Confidence ratings (1=low, 5=high):
${confLines}

Return a JSON array of revision sessions. Each session:
{
  "subject": string,
  "topic": string,
  "scheduledAt": ISO datetime string,
  "durationMins": number,
  "examId": string or null
}

Rules:
- No more than ${input.hoursPerDay} hours of revision per day
- Space the same subject at least 2 days apart
- Prioritise low-confidence subjects (more sessions)
- Include a mix of topics within each subject
- Leave the last week before each exam for past paper practice
- Generate sessions for the next 2 weeks only
- Return between 10 and 20 sessions total`

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { sessions: buildStubPlan(exams, input), error: undefined }
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are a UK secondary school revision coach. You create balanced, realistic revision timetables for GCSE and A-Level students. You prioritise subjects where the student has low confidence, space repetitions using spaced learning principles, and avoid overloading any single day. Always respond with ONLY valid JSON — no preamble.`,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    // Strip markdown fences if present
    const json = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(json) as GeneratedSession[]
    return { sessions: parsed }
  } catch (err) {
    console.error('generateRevisionPlan error:', err)
    return { sessions: buildStubPlan(exams, input), error: 'AI unavailable — showing stub plan' }
  }
}

function buildStubPlan(
  exams: { id: string; subject: string }[],
  input: { hoursPerDay: number; preferredSlots: string[] }
): GeneratedSession[] {
  const sessions: GeneratedSession[] = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const slotHour = input.preferredSlots.includes('morning') ? 9
    : input.preferredSlots.includes('afternoon') ? 14 : 18

  let dayOffset = 1
  for (const exam of exams.slice(0, 4)) {
    const topics = [`Introduction & Key Concepts`, `Core Theory`, `Exam Technique`, `Past Paper Practice`]
    for (const topic of topics.slice(0, 3)) {
      const d = new Date(now)
      d.setDate(d.getDate() + dayOffset)
      d.setHours(slotHour, 0, 0, 0)
      sessions.push({
        subject: exam.subject, topic,
        scheduledAt: d.toISOString(), durationMins: 45,
        examId: exam.id,
      })
      dayOffset += 2
    }
  }
  return sessions.slice(0, 14)
}

export async function saveRevisionPlan(studentId: string, sessions: GeneratedSession[]) {
  await requireStudent()
  await prisma.revisionSession.createMany({
    data: sessions.map(s => ({
      studentId,
      examId:      s.examId || null,
      subject:     s.subject,
      topic:       s.topic,
      scheduledAt: new Date(s.scheduledAt),
      durationMins: s.durationMins ?? 45,
      status:      'planned',
    })),
  })
}

// ─── Session status updates ───────────────────────────────────────────────────

export async function markSessionComplete(
  sessionId: string,
  confidence: number,
  notes?: string,
) {
  const user = await requireStudent()
  const session = await prisma.revisionSession.findUnique({ where: { id: sessionId } })
  if (!session || session.studentId !== user.id) throw new Error('Not authorised')

  await prisma.revisionSession.update({
    where: { id: sessionId },
    data:  { status: 'completed', confidence, notes: notes ?? null },
  })

  // Upsert confidence record
  await prisma.revisionConfidence.create({
    data: {
      studentId:  user.id,
      subject:    session.subject,
      topic:      session.topic,
      confidence,
    },
  })
}

export async function skipSession(sessionId: string) {
  const user = await requireStudent()
  const session = await prisma.revisionSession.findUnique({ where: { id: sessionId } })
  if (!session || session.studentId !== user.id) throw new Error('Not authorised')
  await prisma.revisionSession.update({ where: { id: sessionId }, data: { status: 'skipped' } })
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getConfidenceProfile(studentId: string) {
  await requireStudent()

  const records = await prisma.revisionConfidence.findMany({
    where:   { studentId },
    orderBy: { assessedAt: 'desc' },
  })

  // Group by subject — keep latest per subject+topic, then avg per subject
  const bySubjectTopic = new Map<string, number>()
  for (const r of records) {
    const key = `${r.subject}|||${r.topic}`
    if (!bySubjectTopic.has(key)) bySubjectTopic.set(key, r.confidence)
  }

  const bySubject = new Map<string, number[]>()
  for (const [key, conf] of bySubjectTopic) {
    const subj = key.split('|||')[0]
    if (!bySubject.has(subj)) bySubject.set(subj, [])
    bySubject.get(subj)!.push(conf)
  }

  return Array.from(bySubject.entries()).map(([subject, vals]) => ({
    subject,
    avgConfidence: vals.reduce((a, b) => a + b, 0) / vals.length,
    sessionCount:  vals.length,
  }))
}

export async function getRevisionStats(studentId: string) {
  await requireStudent()

  const [sessions, confidence] = await Promise.all([
    prisma.revisionSession.findMany({
      where:  { studentId },
      select: { status: true, confidence: true, subject: true, scheduledAt: true },
    }),
    prisma.revisionConfidence.findMany({
      where:  { studentId },
      select: { confidence: true, subject: true },
      orderBy: { assessedAt: 'desc' },
    }),
  ])

  const totalPlanned   = sessions.filter(s => s.status === 'planned').length
  const totalCompleted = sessions.filter(s => s.status === 'completed').length
  const totalSkipped   = sessions.filter(s => s.status === 'skipped').length

  const completedWithConf = sessions.filter(s => s.status === 'completed' && s.confidence != null)
  const averageConfidence = completedWithConf.length
    ? completedWithConf.reduce((a, s) => a + (s.confidence ?? 0), 0) / completedWithConf.length
    : null

  // Subject breakdown
  const subjMap = new Map<string, { planned: number; completed: number; skipped: number }>()
  for (const s of sessions) {
    if (!subjMap.has(s.subject)) subjMap.set(s.subject, { planned: 0, completed: 0, skipped: 0 })
    const entry = subjMap.get(s.subject)!
    if (s.status === 'planned') entry.planned++
    else if (s.status === 'completed') entry.completed++
    else entry.skipped++
  }
  const subjectBreakdown = Array.from(subjMap.entries()).map(([subject, counts]) => ({
    subject, ...counts,
  }))

  // Streak: consecutive days with ≥1 completed session up to today
  const completedDates = sessions
    .filter(s => s.status === 'completed')
    .map(s => s.scheduledAt.toISOString().slice(0, 10))
  const uniqueDates = [...new Set(completedDates)].sort().reverse()
  let streakDays = 0
  const today = new Date().toISOString().slice(0, 10)
  let current = today
  for (const d of uniqueDates) {
    if (d === current) {
      streakDays++
      const prev = new Date(current)
      prev.setDate(prev.getDate() - 1)
      current = prev.toISOString().slice(0, 10)
    } else break
  }

  return { totalPlanned, totalCompleted, totalSkipped, averageConfidence, subjectBreakdown, streakDays }
}
