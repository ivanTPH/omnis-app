/**
 * /api/cron/demo-advance  — Monday 00:00 UTC
 *
 * Keeps the Omnis demo feeling current each week:
 *   A. Heal any broken AI lesson slides (missing <body>)
 *   B. Create lesson records for this week's timetable slots (one per class per slot)
 *      then generate 3 new MCQ homeworks (one per English class) linked to the primary lesson
 *   C. Create realistic student submissions for each new homework
 *
 * Fully idempotent — safe to re-run at any point in the same week.
 * Requires ANTHROPIC_API_KEY in environment; skips AI phases gracefully if absent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                   from '@/lib/prisma'
import { HomeworkStatus, SubmissionStatus, AgentType, AgentReviewOutcome } from '@prisma/client'
import Anthropic                    from '@anthropic-ai/sdk'
import { markDirty }                from '@/lib/agents/snapshot'
import { checkILPEvidenceMatch }    from '@/app/actions/ilp-evidence'

export const maxDuration = 300

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns ISO week number (1–53) for a given date */
function isoWeek(d: Date): number {
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const weekOfYear = Math.floor((dayOfYear - 1 + ((jan4.getDay() || 7) - 1)) / 7)
  return Math.max(1, weekOfYear)
}

/** Monday of the current school week */
function thisMonday(): Date {
  const now = new Date()
  const dow = now.getDay()
  const d   = new Date(now)
  if (dow === 6)      d.setDate(now.getDate() + 2)
  else if (dow === 0) d.setDate(now.getDate() + 1)
  else                d.setDate(now.getDate() - (dow - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Deterministic score for a student+homework seed string */
function studentScore(grade: number, numQuestions: number, seedStr: string): number {
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = ((h << 5) - h + seedStr.charCodeAt(i)) | 0
  const jitter   = (Math.abs(Math.sin(h)) - 0.5) * 0.15
  const accuracy = Math.max(0.05, Math.min(0.98, 0.08 + (grade / 9) * 0.87 + jitter))
  return Math.max(0, Math.min(numQuestions, Math.round(accuracy * numQuestions)))
}

// ── Lesson slide constants (same CSS as demo-generate.ts) ────────────────────

const SLIDE_CSS = `body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px;background:#f1f5f9;color:#1e293b}
.slide{background:#fff;max-width:900px;margin:24px auto;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.1);overflow:hidden}
.sh{background:#1d4ed8;color:#fff;padding:24px 36px 20px}
.sh h1{margin:0 0 6px;font-size:2rem;line-height:1.2}
.sh h2{margin:0 0 4px;font-size:1.25rem}
.sh p,.sh small{margin:0;opacity:.85;font-size:.9rem}
.sb{padding:28px 36px 32px}
.badge{display:inline-block;background:rgba(255,255,255,.18);border-radius:20px;padding:3px 12px;font-size:.8rem;margin-bottom:12px}
.obj{background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:0 8px 8px 0;padding:16px 20px;margin-top:8px}
.obj h3{color:#1d4ed8;margin:0 0 10px;font-size:.95rem;text-transform:uppercase;letter-spacing:.5px}
.obj ol{margin:0;padding-left:18px}
.obj li{margin-bottom:7px;font-size:.95rem;line-height:1.4}
.card{background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-bottom:14px}
.card h4{margin:0 0 8px;color:#1d4ed8;font-size:.95rem}
.card p,.card ul,.card ol{margin:0;font-size:.92rem;line-height:1.6}
.card ul,.card ol{padding-left:16px}
.hl{background:#eff6ff;border:2px solid #1d4ed8;border-radius:8px;padding:16px 20px;margin-bottom:14px}
.hl h4{color:#1d4ed8;margin:0 0 8px;font-size:.95rem}
.qb{background:#1e293b;color:#e2e8f0;border-radius:8px;padding:16px 20px;margin:14px 0;font-style:italic;font-size:1rem;line-height:1.6}
.qb::before{content:'"';font-size:2.5rem;color:#1d4ed8;float:left;line-height:1;margin-right:10px}
.timer{background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 18px;font-weight:bold;color:#92400e;margin-bottom:14px;font-size:.9rem}
.sc{background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:16px 20px;margin-top:14px}
.sc h4{color:#166534;margin:0 0 10px;font-size:.9rem;text-transform:uppercase;letter-spacing:.4px}
.sc ul{margin:0;padding-left:16px}
.sc li{margin-bottom:6px;font-size:.9rem;color:#166534;line-height:1.4}
.tkb{background:#1d4ed8;color:#fff;border-radius:8px;padding:16px 20px;display:flex;gap:14px;align-items:flex-start;margin-bottom:12px}
.tbn{background:rgba(255,255,255,.22);border-radius:50%;min-width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:.9rem;flex-shrink:0}
.tbc h5{margin:0 0 3px;font-size:.92rem}
.tbc p{margin:0;font-size:.85rem;opacity:.88}
.lbl{text-transform:uppercase;font-size:.72rem;letter-spacing:1px;color:#1d4ed8;font-weight:bold;margin-bottom:6px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.tag{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:12px;padding:2px 10px;font-size:.76rem;font-weight:bold;margin-right:5px;margin-bottom:3px}`

type SlideSpec = {
  id: string; title: string; subject: string; yearGroup: number
  topic: string; objectives: string[]
}

function wrapSlideHtml(spec: SlideSpec, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${spec.title} | Year ${spec.yearGroup} ${spec.subject}</title>
<style>${SLIDE_CSS}</style>
</head>
<body>
${bodyContent}
</body>
</html>`
}

// ── Rotating topic pools ──────────────────────────────────────────────────────

type HwTopic = {
  classId:    string
  title:      string
  topic:      string
  subject:    string
  yearGroup:  number
  examBoard:  string
}

// Topic pools ordered to reflect natural curriculum progression:
//   AIC:     context → form → core themes → character → extended themes → evaluation
//   Macbeth: context → ambition arc → deception → masculinity → guilt → language
//   Paper:   P1 Q1/Q2 → P1 Q3 → P1 Q4 → P2 Q4 → P2 Q3 → P2 Q5

const AIC_POOL: HwTopic[] = [
  // Week 1 — Historical context before reading the play
  { classId: 'demo-class-9E-En1', subject: 'English Literature', yearGroup: 9, examBoard: 'AQA',
    title: 'AIC — Edwardian Society: Class, Gender and Power',
    topic: "The historical context of 1912 Edwardian England: rigid class hierarchy, gender inequality, and how Priestley uses these social structures to critique complacency in the face of injustice" },
  // Week 2 — Form and structure: how the play works
  { classId: 'demo-class-9E-En1', subject: 'English Literature', yearGroup: 9, examBoard: 'AQA',
    title: 'AIC — Staging, Structure and Dramatic Tension',
    topic: "Priestley's use of dramatic structure: the unities of time, place and action; the confined setting; the Inspector's exits and entrances as structural devices to build tension" },
  // Week 3 — Core theme of responsibility
  { classId: 'demo-class-9E-En1', subject: 'English Literature', yearGroup: 9, examBoard: 'AQA',
    title: 'AIC — Guilt, Confession and Moral Responsibility',
    topic: "How each character's response to guilt reveals their moral character: Sheila's genuine remorse, Arthur's defensiveness, and Eric's eventual acceptance of responsibility" },
  // Week 4 — The Inspector as political voice
  { classId: 'demo-class-9E-En1', subject: 'English Literature', yearGroup: 9, examBoard: 'AQA',
    title: 'AIC — The Inspector as a Socialist Voice',
    topic: "How Priestley uses the Inspector as a mouthpiece for socialist ideology: his all-knowing authority, interrogation style, and final speech as a political message about collective responsibility" },
  // Week 5 — Character study: Sheila's arc
  { classId: 'demo-class-9E-En1', subject: 'English Literature', yearGroup: 9, examBoard: 'AQA',
    title: "AIC — Sheila's Character Arc and Moral Growth",
    topic: "Sheila Birling's transformation from a naive, privileged young woman into the play's moral compass — her growing consciousness of social responsibility across the three acts" },
  // Week 6 — Evaluation: the ending and Priestley's purpose
  { classId: 'demo-class-9E-En1', subject: 'English Literature', yearGroup: 9, examBoard: 'AQA',
    title: 'AIC — The Ending: Ambiguity and Unresolved Guilt',
    topic: "The significance of the ending: the Birlings' return to denial, the mysterious phone call, and how Priestley uses the open ending to challenge the audience to examine their own conscience" },
]

const MACBETH_POOL: HwTopic[] = [
  // Week 1 — Context: Jacobean kingship and divine right
  { classId: 'demo-class-10E-En2', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA',
    title: 'Macbeth — Kingship, Tyranny and the Divine Right',
    topic: "What constitutes legitimate versus illegitimate rule in Macbeth: the contrast between Duncan's benevolent kingship, Macbeth's tyranny, and Malcolm's qualities as future king — reflected through Jacobean political beliefs" },
  // Week 2 — Ambition and the corruption arc (Acts 1–2)
  { classId: 'demo-class-10E-En2', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA',
    title: 'Macbeth — Corruption and the Abuse of Power',
    topic: "How Shakespeare traces Macbeth's moral deterioration from heroic warrior to tyrannical king: key scenes showing his increasing willingness to murder, betray, and silence opposition" },
  // Week 3 — Appearance vs reality (runs throughout)
  { classId: 'demo-class-10E-En2', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA',
    title: 'Macbeth — Appearance vs Reality: Deception and Disguise',
    topic: "The theme of appearance vs reality throughout Macbeth: the witches' equivocation, Lady Macbeth's mask, and how characters who seem loyal or innocent are exposed as dangerous or deceived" },
  // Week 4 — Masculinity and violence (Act 3 focus)
  { classId: 'demo-class-10E-En2', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA',
    title: 'Macbeth — Violence, Masculinity and Honour',
    topic: "How Shakespeare interrogates ideas of masculinity through violence: Lady Macbeth's challenge to Macbeth's manhood, the culture of honour killing in Jacobean Scotland, and what constitutes true bravery" },
  // Week 5 — Guilt and psychological decline (Acts 3–5)
  { classId: 'demo-class-10E-En2', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA',
    title: 'Macbeth — Guilt, Conscience and Psychological Decline',
    topic: "Macbeth and Lady Macbeth's contrasting psychological responses to guilt: Macbeth's hallucinations and paranoia, Lady Macbeth's sleepwalking and mental collapse, and Shakespeare's portrayal of conscience as punishment" },
  // Week 6 — Language analysis: blood imagery (synthesis/revision)
  { classId: 'demo-class-10E-En2', subject: 'English Literature', yearGroup: 10, examBoard: 'AQA',
    title: 'Macbeth — Blood, Imagery and Language of Violence',
    topic: "Shakespeare's sustained use of blood imagery from the opening battle to the final confrontation: how repeated metaphors of blood, darkness and unnatural events create a world where violence corrupts everything it touches" },
]

const PAPER_POOL: HwTopic[] = [
  // Week 1 — Paper 1 Q1/Q2: reading for information and language
  { classId: 'demo-class-11E-En1', subject: 'English Language', yearGroup: 11, examBoard: 'AQA',
    title: 'Paper 1 — Opening Descriptions: Setting and Atmosphere',
    topic: "AQA Paper 1 Q1/Q2: how writers use opening descriptions to establish setting and atmosphere — techniques including pathetic fallacy, sensory imagery, and the careful selection of specific detail to create mood" },
  // Week 2 — Paper 1 Q3: structural analysis
  { classId: 'demo-class-11E-En1', subject: 'English Language', yearGroup: 11, examBoard: 'AQA',
    title: 'Paper 1 — Structural Choices: Form, Sequence and Pacing',
    topic: "AQA Paper 1 Q3: how writers use structural devices — non-linear timelines, circular structure, shifts in focus, cliffhangers — to control pace, build tension, and guide the reader through a fiction text" },
  // Week 3 — Paper 1 Q4: evaluation and narrative voice
  { classId: 'demo-class-11E-En1', subject: 'English Language', yearGroup: 11, examBoard: 'AQA',
    title: 'Paper 1 — Narrative Voice, Perspective and Unreliability',
    topic: "How writers construct narrative voice in fiction: first-person vs third-person narration, free indirect discourse, unreliable narrators, and how perspective shapes the reader's sympathies in AQA Paper 1 extracts" },
  // Week 4 — Paper 2 Q4: comparing non-fiction perspectives
  { classId: 'demo-class-11E-En1', subject: 'English Language', yearGroup: 11, examBoard: 'AQA',
    title: 'Paper 2 — Non-Fiction Comparison: Strategy and Structure',
    topic: "AQA Paper 2 Q4: comparing two non-fiction writers' perspectives — identifying differences in viewpoint, selecting evidence from both texts, and structuring a comparative response using connective language" },
  // Week 5 — Paper 2 Q3: language and attitude analysis
  { classId: 'demo-class-11E-En1', subject: 'English Language', yearGroup: 11, examBoard: 'AQA',
    title: "Paper 2 — Writers' Attitudes: Bias, Rhetoric and Tone",
    topic: "How non-fiction writers reveal attitude and bias: use of rhetorical questions, direct address, hyperbole, and emotive language to persuade — with reference to AQA Paper 2 Q3 comparing two source texts" },
  // Week 6 — Paper 2 Q5: persuasive writing techniques (synthesis)
  { classId: 'demo-class-11E-En1', subject: 'English Language', yearGroup: 11, examBoard: 'AQA',
    title: 'Paper 2 — Rhetoric and Persuasive Language in Non-Fiction',
    topic: "How persuasive writers use rhetoric across non-fiction forms: speech, article, letter — analysing the rule of three, anaphora, ethos/logos/pathos, and counter-argument strategies in AQA Paper 2 sources" },
]

const MCQ_GRADING_BANDS = { '0': 'Grade 3', '1': 'Grade 4', '2': 'Grade 5', '3': 'Grade 6', '4': 'Grade 7', '5': 'Grade 9' }

// ── Weekly timetable slots for each demo English class ────────────────────────
// day: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri; hour: lesson start hour (24h)
type TimetableSlot = { day: number; hour: number; durationMins: number }
// UTC hours matching actual seed scheduledAt values (seed was run in BST so stores local time as UTC):
//   9E Mon 09:00 UTC, Wed 09:00 UTC, Fri 14:00 UTC
//   10E Mon 11:00 UTC, Thu 11:00 UTC
//   11E Tue 10:00 UTC, Wed 13:00 UTC
const CLASS_TIMETABLE: Record<string, TimetableSlot[]> = {
  'demo-class-9E-En1':  [{ day: 1, hour: 9, durationMins: 60 }, { day: 3, hour: 9, durationMins: 60 }, { day: 5, hour: 14, durationMins: 60 }],
  'demo-class-10E-En2': [{ day: 1, hour: 11, durationMins: 60 }, { day: 4, hour: 11, durationMins: 60 }],
  'demo-class-11E-En1': [{ day: 2, hour: 10, durationMins: 60 }, { day: 3, hour: 13, durationMins: 60 }],
}

/** Return a Date for day-of-week (1=Mon) + hour in the current week */
function slotDate(monday: Date, dayOfWeek: number, hour: number): Date {
  const d = new Date(monday)
  d.setDate(monday.getDate() + (dayOfWeek - 1))
  d.setHours(hour, 0, 0, 0)
  return d
}

// ── MCQ generation helpers (mirrors demo-generate.ts) ─────────────────────────

type McqQuestion = {
  id: string; question: string; options: string[]
  correct: string; marks: number; scaffolding_hint: string; ehcp_adaptation: string
}

function parseJsonSafely(raw: string): McqQuestion[] {
  let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
  const m = s.match(/\{[\s\S]*\}/)
  if (m) s = m[0]
  try { return (JSON.parse(s) as any).questions } catch { /* fall through */ }
  s = s.replace(/"([^"]*)"/g, (_: string, inner: string) =>
    `"${inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`)
  return (JSON.parse(s) as any).questions
}

async function generateMcqQuestions(hw: HwTopic, ai: Anthropic): Promise<McqQuestion[]> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const msg = await ai.messages.create({
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
      const raw       = (msg.content[0] as any).text as string
      const questions = parseJsonSafely(raw)
      if (Array.isArray(questions) && questions.length > 0) return questions
      throw new Error('Empty questions array')
    } catch (err) {
      if (attempt === 3) throw err
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error('Failed after 3 attempts')
}

async function generateSlidesBase64(spec: SlideSpec, ai: Anthropic): Promise<string> {
  const msg = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: `You are an expert UK secondary school teacher. Generate lesson slide HTML content for Year ${spec.yearGroup} ${spec.subject} (AQA).
CSS is already provided — output ONLY the slide <div> elements for the <body>. No DOCTYPE, no <html>, no <head>, no <style>, no <body> tags.
Use these CSS classes: .slide .sh .sb .badge .obj .card .hl .qb .timer .sc .tkb .tbn .tbc .lbl .grid2 .tag
Keep each slide focused and curriculum-appropriate. Include real quotes, examples, and exam-style tasks.`,
    messages: [{
      role: 'user',
      content: `Generate slide divs for:
Title: ${spec.title}
Topic: ${spec.topic}
Learning Objectives:
${spec.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Output exactly 6 <div class="slide"> blocks:
1. Title slide — lesson title, subject/year/board badge, learning objectives in .obj
2. Starter — .timer "⏱ 3 minutes", retrieval question or hook in .card
3. Key Knowledge — key facts/quotes in .card and .qb blocks with source attribution
4. Deeper Analysis — worked example or analytical model in .card, step-by-step in .hl
5. Your Task — exam-style question in .hl, success criteria in .sc
6. Plenary — 3 key takeaways each in .tkb, homework reminder

Return ONLY the 6 <div class="slide"> elements. No preamble. Start immediately with <div class="slide">.`,
    }],
  })
  const raw = (msg.content[0] as any).text as string
  const bodyContent = raw.replace(/^```html?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  if (!bodyContent.includes('<div') || !bodyContent.includes('slide')) {
    throw new Error('Response missing slide div elements')
  }
  return Buffer.from(wrapSlideHtml(spec, bodyContent)).toString('base64')
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth       = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const ai     = apiKey ? new Anthropic({ apiKey }) : null

  // Look up demo school + teacher
  const school = await prisma.school.findFirst({
    where: { OR: [{ name: 'Omnis Demo School' }, { emailDomain: 'omnisdemo.school' }] },
    select: { id: true },
  })
  if (!school) {
    return NextResponse.json({ error: 'Demo school not found' }, { status: 404 })
  }
  const teacher = await prisma.user.findFirst({
    where: { email: 'j.patel@omnisdemo.school' },
    select: { id: true },
  })
  if (!teacher) {
    return NextResponse.json({ error: 'Demo teacher not found' }, { status: 404 })
  }

  const schoolId  = school.id
  const teacherId = teacher.id

  let slidesHealed   = 0
  let slidesSkipped  = 0
  let lessonsCreated = 0
  let hwCreated      = 0
  let hwSkipped      = 0
  let subsCreated    = 0

  // ── Phase A: Heal broken AI lesson slides ────────────────────────────────────
  // Demo lesson slide specs (must match demo-generate.ts LESSON_SLIDE_SPECS)
  const LESSON_SPECS: SlideSpec[] = [
    { id: 'demo-lesson-9E-d0-h9',   title: 'An Inspector Calls — Act 1 Introduction',      subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls',  objectives: ['Understand the social and historical context', "Identify Priestley's messages about social responsibility", "Analyse the Inspector's dramatic arrival"] },
    { id: 'demo-lesson-10E-d0-h11', title: 'Macbeth — Ambition and Power',                  subject: 'English Literature', yearGroup: 10, topic: 'Macbeth',             objectives: ['Explore how Shakespeare presents ambition as destructive', 'Analyse key soliloquies from Acts 1 and 2', 'Develop PEE paragraphs with textual evidence'] },
    { id: 'demo-lesson-11E-d1-h10', title: 'Paper 1 Unseen Fiction Practice',               subject: 'English Language',   yearGroup: 11, topic: 'AQA Paper 1',         objectives: ['Apply Paper 1 Q4 skills to unseen extract', 'Structure a 20-mark response under timed conditions', 'Peer-assess using mark scheme descriptors'] },
    { id: 'demo-lesson-9E-d2-h9',   title: 'An Inspector Calls — Character Study',          subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls',  objectives: ['Trace character development across the play', 'Compare generational attitudes to responsibility', 'Write a structured character analysis paragraph'] },
    { id: 'demo-lesson-11E-d2-h13', title: 'Paper 2 Non-Fiction — Language Analysis',       subject: 'English Language',   yearGroup: 11, topic: 'AQA Paper 2',         objectives: ['Identify language techniques in non-fiction', "Compare writers' perspectives using subject terminology", 'Plan and write a Q4 comparative response'] },
    { id: 'demo-lesson-10E-d3-h11', title: 'Macbeth — Soliloquy Analysis',                  subject: 'English Literature', yearGroup: 10, topic: 'Macbeth',             objectives: ['"Is this a dagger" and "Tomorrow" close-read', 'Explore how soliloquy reveals inner conflict', 'Practise A-grade analysis using context and language'] },
    { id: 'demo-lesson-9E-d4-h14',  title: 'An Inspector Calls — Responsibility Theme',     subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls',  objectives: ['Evaluate how Priestley uses characters to explore responsibility', 'Write a timed response to an exam-style question', 'Self-assess using GCSE mark scheme'] },
    { id: 'demo-future-9E-d0',      title: 'An Inspector Calls — Essay Planning',           subject: 'English Literature', yearGroup: 9,  topic: 'An Inspector Calls',  objectives: ['Plan a high-band essay response', 'Select and embed quotations effectively', 'Structure an argument for a 30-mark essay'] },
    { id: 'demo-future-10E-d1',     title: 'Macbeth — Key Quotations Review',               subject: 'English Literature', yearGroup: 10, topic: 'Macbeth',             objectives: ['Identify and memorise key quotations per theme', 'Practise embedding quotes in analysis paragraphs', 'Evaluate quotation choice for exam conditions'] },
    { id: 'demo-future-11E-d2',     title: 'Mock Exam Paper 1 — Timed Practice',            subject: 'English Language',   yearGroup: 11, topic: 'AQA Paper 1',         objectives: ['Complete a full Paper 1 under timed conditions', 'Apply learned strategies across all four questions', 'Reflect on performance and identify improvements'] },
  ]

  if (ai) {
    for (const spec of LESSON_SPECS) {
      try {
        const existing = await prisma.resource.findFirst({
          where: { lessonId: spec.id, isAiGenerated: true, type: 'SLIDES' },
          select: { id: true, url: true },
        })
        if (existing) {
          // Check for valid HTML body
          const b64  = existing.url?.split(',')[1] ?? ''
          const html = Buffer.from(b64, 'base64').toString('utf8')
          if (html.includes('<body')) { slidesSkipped++; continue }
          // Broken — delete and regenerate
          await prisma.resource.delete({ where: { id: existing.id } })
        }
        const b64 = await generateSlidesBase64(spec, ai)
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
        slidesHealed++
        await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        console.error(`[demo-advance] slide ${spec.id} failed:`, err)
      }
    }
  }

  // ── Phase B: Weekly MCQ homework (3 new — one per English class) ─────────────
  const weekIndex = isoWeek(new Date())
  const cycleLen  = AIC_POOL.length  // all pools have the same length (6)
  const topicIdx  = (weekIndex - 1) % cycleLen

  const weeklyTopics: HwTopic[] = [
    AIC_POOL[topicIdx]!,
    MACBETH_POOL[topicIdx]!,
    PAPER_POOL[topicIdx]!,
  ]

  // dueAt = Friday of this school week
  const monday = thisMonday()
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 0, 0)

  // Next Monday (for pre-creating next week's lessons so the calendar isn't empty)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)

  // ── Phase B.1: Create lesson records for this week AND next week ─────────────
  // Each class gets one lesson per timetable slot. The first NEWLY CREATED slot
  // in the CURRENT week is used as the primary lesson linked to the homework.
  // We intentionally do NOT link to pre-existing seed lessons (demo-future-*)
  // because those may already have other homework attached and would be collapsed
  // by the student list dedup.
  const primaryLessonByClass = new Map<string, string>()  // classId → newly created lessonId

  for (const weekMonday of [monday, nextMonday]) {
    const isCurrentWeek = weekMonday === monday
    const nextWeekTopicIdx = ((weekIndex) % cycleLen)
    const weekTopics = isCurrentWeek
      ? weeklyTopics
      : [AIC_POOL[nextWeekTopicIdx]!, MACBETH_POOL[nextWeekTopicIdx]!, PAPER_POOL[nextWeekTopicIdx]!]

    for (const hw of weekTopics) {
      const slots = CLASS_TIMETABLE[hw.classId] ?? []
      let firstNewLessonId: string | null = null

      for (const slot of slots) {
        const scheduledAt = slotDate(weekMonday, slot.day, slot.hour)
        const endsAt      = new Date(scheduledAt.getTime() + slot.durationMins * 60_000)

        // Idempotency: skip if a lesson already exists for this class at this exact time
        const existingLesson = await prisma.lesson.findFirst({
          where: { schoolId, classId: hw.classId, scheduledAt },
          select: { id: true },
        })
        if (existingLesson) continue

        try {
          const lesson = await prisma.lesson.create({
            data: {
              schoolId,
              classId:    hw.classId,
              title:      hw.title,
              topic:      hw.topic.slice(0, 120),
              examBoard:  hw.examBoard,
              objectives: [
                `Understand and analyse: ${hw.topic.split(':')[0].trim()}`,
                'Apply knowledge using textual evidence and subject terminology',
                'Practise exam-style writing under structured conditions',
              ],
              scheduledAt,
              endsAt,
              published:  true,
              createdBy:  teacherId,
            },
          })
          if (isCurrentWeek && !firstNewLessonId) firstNewLessonId = lesson.id
          lessonsCreated++
        } catch (err) {
          console.error(`[demo-advance] lesson ${hw.classId} slot d${slot.day}h${slot.hour} failed:`, err)
        }
      }

      if (isCurrentWeek && firstNewLessonId) primaryLessonByClass.set(hw.classId, firstNewLessonId)
    }
  }

  // ── Phase B.2: Generate MCQ homework and link to primary lesson ───────────────
  const newHwMap = new Map<string, { hwId: string; questions: McqQuestion[]; title: string; subject: string }>()

  for (const hw of weeklyTopics) {
    // Idempotency: skip if this exact title already exists for this class (any week)
    // This prevents creating MCQ duplicates when seeded homework has the same title with an older due date
    const existing = await prisma.homework.findFirst({
      where: {
        schoolId,
        classId: hw.classId,
        title:   hw.title,
      },
      select: { id: true, structuredContent: true },
    })
    if (existing) {
      const qs = (existing.structuredContent as any)?.questions as McqQuestion[] ?? []
      newHwMap.set(hw.classId, { hwId: existing.id, questions: qs, title: hw.title, subject: hw.subject })
      hwSkipped++
      continue
    }

    if (!ai) { hwSkipped++; continue }

    const lessonId = primaryLessonByClass.get(hw.classId)

    try {
      const questions = await generateMcqQuestions(hw, ai)
      const homework  = await prisma.homework.create({
        data: {
          schoolId,
          classId:             hw.classId,
          lessonId:            lessonId ?? null,
          title:               hw.title,
          instructions:        `Answer all ${questions.length} questions on: ${hw.topic}. Choose the best answer for each.`,
          modelAnswer:         questions.map((q, i) => `Q${i + 1}: ${q.correct}`).join('\n'),
          dueAt:               friday,
          status:              HomeworkStatus.PUBLISHED,
          type:                'MCQ_QUIZ',
          createdBy:           teacherId,
          homeworkVariantType: 'multiple_choice',
          structuredContent:   { questions },
          gradingBands:        MCQ_GRADING_BANDS,
          learningObjectives:  [hw.topic],
          bloomsLevel:         'Understand',
          estimatedMins:       15,
        },
      })
      newHwMap.set(hw.classId, { hwId: homework.id, questions, title: hw.title, subject: hw.subject })
      hwCreated++
    } catch (err) {
      console.error(`[demo-advance] homework ${hw.title} failed:`, err)
    }
  }

  // ── Phase C: Student submissions for new homework ─────────────────────────────
  const dirtyStudents = new Set<string>()  // collect students who got new submissions

  // Pre-fetch active ILP targets for SEND students so we can fire evidence-match checks
  const sendIlpMap = new Map<string, Array<{ id: string; description: string }>>()
  if (ai) {
    const sendIlps = await prisma.individualLearningPlan.findMany({
      where: {
        schoolId,
        status: 'active',
        student: { sendStatus: { activeStatus: { not: 'NONE' } } },
      },
      select: {
        studentId: true,
        targets: { where: { status: 'active' }, select: { id: true, target: true } },
      },
    })
    for (const ilp of sendIlps) {
      if (ilp.targets.length > 0) {
        sendIlpMap.set(ilp.studentId, ilp.targets.map(t => ({ id: t.id, description: t.target })))
      }
    }
  }

  for (const [classId, { hwId, questions, title: hwTitle, subject: hwSubject }] of newHwMap.entries()) {
    if (!questions.length) continue

    const enrolments = await prisma.enrolment.findMany({
      where: { classId },
      select: { user: { select: { id: true, email: true } } },
    })

    // Fetch workingAtGrade from StudentLearningProfile for each student
    const studentIds    = enrolments.map(e => e.user.id)
    const profileGrades = await prisma.studentLearningProfile.findMany({
      where:  { studentId: { in: studentIds }, schoolId },
      select: { studentId: true, workingAtGrade: true },
    })
    const gradeByStudent = new Map(profileGrades.map(p => [p.studentId, p.workingAtGrade ?? 5]))

    for (const { user: student } of enrolments) {
      // Idempotency: skip if submission already exists
      const exists = await prisma.submission.findFirst({
        where: { homeworkId: hwId, studentId: student.id },
        select: { id: true },
      })
      if (exists) continue

      const grade      = gradeByStudent.get(student.id) ?? 5
      const numCorrect = studentScore(grade, questions.length, `${student.id}-${hwId}`)

      // Deterministic shuffle — same student+homework always picks same wrong answers
      let h = 0
      for (const c of `${student.id}${hwId}`) h = ((h << 5) - h + c.charCodeAt(0)) | 0
      const indices    = questions.map((_, i) => i)
      indices.sort((a, b) => Math.sin((h + a) * 13.7) - Math.sin((h + b) * 13.7))
      const correctSet = new Set(indices.slice(0, numCorrect))

      const answers = questions.map((q, i) =>
        correctSet.has(i) ? q.correct : (q.options.find(o => o !== q.correct) ?? q.options[0])
      )

      const submittedAt = new Date(friday)
      submittedAt.setHours(submittedAt.getHours() - Math.floor(Math.abs(Math.sin(h)) * 16) - 2)
      const markedAt = new Date(friday)
      markedAt.setDate(markedAt.getDate() + 1)
      markedAt.setHours(9, 0, 0, 0)

      const feedback = numCorrect >= 4
        ? `Well done — you scored ${numCorrect}/${questions.length}. Strong understanding of this topic. Keep using specific evidence in your answers.`
        : numCorrect >= 3
        ? `Good effort. You scored ${numCorrect}/${questions.length}. Review the questions you missed — re-read your notes on this topic.`
        : `You scored ${numCorrect}/${questions.length}. This topic needs more revision. Use the scaffolding hints when you review your answers.`

      try {
        const sub = await prisma.submission.create({
          data: {
            schoolId,
            homeworkId:         hwId,
            studentId:          student.id,
            content:            '',
            status:             SubmissionStatus.RETURNED,
            structuredResponse: { answers },
            autoScore:          numCorrect,
            finalScore:         numCorrect,
            autoFeedback:       feedback,
            feedback,
            autoMarked:         true,
            teacherReviewed:    false,
            submittedAt,
            markedAt,
          },
        })
        dirtyStudents.add(student.id)
        subsCreated++

        // Fire-and-forget ILP evidence matching for SEND students with active ILPs
        const ilpTargets = sendIlpMap.get(student.id)
        if (ilpTargets && ai) {
          const gcseGrade = (MCQ_GRADING_BANDS[String(numCorrect) as keyof typeof MCQ_GRADING_BANDS] ?? 'Grade 3').replace('Grade ', '')
          void checkILPEvidenceMatch({
            submissionId: sub.id,
            studentId:    student.id,
            ilpTargets,
            homeworkTitle: hwTitle,
            subject:       hwSubject,
            grade:         gcseGrade,
            schoolId,
            teacherId,
            homeworkId:    hwId,
          }).catch(() => {})
        }
      } catch (err) {
        console.error(`[demo-advance] submission ${student.id} failed:`, err)
      }
    }
  }

  // Signal COACH + QUALITY + EVIDENCE agents that new marked submissions exist
  if (dirtyStudents.size > 0) {
    void Promise.allSettled(
      [...dirtyStudents].map(studentId =>
        markDirty(studentId, schoolId, [AgentType.COACH, AgentType.QUALITY, AgentType.EVIDENCE])
      )
    ).catch(() => {})
  }

  // ── Phase D: Demo realism — agent insights, teacher reviews, SEND concern, messages, behaviour ──
  let insightsReviewed    = 0
  let submissionsReviewed = 0
  let concernsRaised      = 0
  let messagesAdded       = 0
  let behaviourLogged     = 0
  let concernsProgressed      = 0
  let notificationsCleared    = 0
  let taNotesAdded            = 0
  let ilpEntriesLinked        = 0
  let negativeBehaviourLogged = 0
  let receiptsMarkedRead      = 0
  let teacherRepliesAdded     = 0
  let apdrUpdated             = 0
  let revisionSessionsAdded   = 0

  const [senco, demoParent, ta, demoStudent] = await Promise.all([
    prisma.user.findFirst({ where: { email: 'r.morris@omnisdemo.school' },                   select: { id: true } }),
    prisma.user.findFirst({ where: { email: 'l.hughes@parents.omnisdemo.school' },           select: { id: true } }),
    prisma.user.findFirst({ where: { email: 'j.taylor@omnisdemo.school' },                   select: { id: true } }),
    prisma.user.findFirst({ where: { email: 'a.hughes@students.omnisdemo.school' },          select: { id: true } }),
  ])

  const phaseDHwIds = [...newHwMap.values()].map(v => v.hwId)

  // ── D.1: Auto-confirm 4 + dismiss 1 oldest unreviewed agent insights ──────────
  if (senco) {
    try {
      const pending = await prisma.agentAuditEntry.findMany({
        where: { schoolId, reviewedAt: null, createdAt: { lt: new Date(Date.now() - 6 * 3600_000) } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 6,
      })
      for (const [i, entry] of pending.entries()) {
        const isDismiss = i >= 4
        await prisma.agentAuditEntry.update({
          where: { id: entry.id },
          data: {
            reviewedById: senco.id,
            reviewedAt:   new Date(),
            reviewOutcome: isDismiss ? AgentReviewOutcome.DISMISSED : AgentReviewOutcome.CONFIRMED,
            ...(isDismiss ? { reviewNote: 'Noted — monitoring. No immediate action required this cycle.' } : {}),
          },
        })
        insightsReviewed++
      }
    } catch (err) { console.error('[demo-advance] D.1 agent insights:', err) }
  }

  // ── D.2: Teacher-review top 2 submissions + 1 SEND submission, add notes ──────
  const TEACHER_NOTES: Record<string, string[]> = {
    'demo-class-9E-En1': [
      'Excellent historical awareness — your connection to Edwardian class structure shows real depth. Keep weaving context through every paragraph.',
      'Strong structural commentary. Push for shorter, more precise embedded quotations — two well-chosen words can do more analytical work than a full line.',
      'Thoughtful exploration of guilt. Now practise comparing the generations\' contrasting responses within a single paragraph for higher marks.',
      'Outstanding grasp of the Inspector\'s political purpose. Ensure every AO3 point links back to Priestley\'s post-war message to the audience.',
      'Very perceptive character analysis of Sheila. Apply this same level of insight to Arthur Birling in your next timed response.',
      'Excellent engagement with the ambiguity of the ending — this kind of evaluative reading will score very highly under exam conditions.',
    ],
    'demo-class-10E-En2': [
      'Clear, confident grasp of kingship. Work on integrating AO3 context — one sentence on Jacobean beliefs per paragraph will push this to Grade 7.',
      'Solid analysis of the corruption arc. More precise language analysis would lift this — focus on individual word choices rather than full quotations.',
      'Good exploration of deception — the "Fair is foul" analysis is perceptive. Develop this into a point about dramatic irony for the audience.',
      'Strong commentary on masculinity. Consider how Shakespeare challenges these values, not just presents them — a more evaluative approach.',
      'Excellent on guilt and psychological decline. Your comparison of Macbeth and Lady Macbeth shows real analytical depth — keep this up in timed work.',
      'Outstanding blood imagery analysis — this reads like Grade 8 thinking. Channel this precision into your next full timed essay.',
    ],
    'demo-class-11E-En1': [
      'Well-structured Paper 1 opening. For Q2 develop your points about the effect on the reader, not just the technique itself.',
      'Good Q3 structural analysis. Sequence your points — start, middle, end of the extract — rather than moving back and forth through the text.',
      'Perceptive on narrative voice. Use tentative evaluative language in Q4: "perhaps", "arguably", "it could be suggested" — signals higher-level thinking.',
      'Strong comparative framework for Q4. Develop the contrast in tone between the two writers more explicitly — this is where marks are awarded.',
      'Excellent rhetorical analysis for Q3. Always name the specific technique before analysing its effect, then link effect to the writer\'s purpose.',
      'Outstanding precision on persuasive techniques — this shows real command of Paper 2. Apply this rigour under timed conditions this week.',
    ],
  }

  if (phaseDHwIds.length > 0) {
    try {
      const hwIdToClassId = new Map([...newHwMap.entries()].map(([classId, v]) => [v.hwId, classId]))
      const candidates = await prisma.submission.findMany({
        where: { homeworkId: { in: phaseDHwIds }, schoolId, finalScore: { not: null } },
        select: {
          id: true, studentId: true, finalScore: true, homeworkId: true,
          student: { select: { sendStatus: { select: { activeStatus: true } } } },
        },
        orderBy: { finalScore: 'desc' },
      })
      const top2 = candidates.slice(0, 2)
      const sendSub = candidates.find(
        s => !top2.some(t => t.id === s.id) && !!s.student.sendStatus?.activeStatus && s.student.sendStatus.activeStatus !== 'NONE'
      )
      const toReview = [...top2, ...(sendSub ? [sendSub] : [])]

      for (const sub of toReview) {
        const existing = await prisma.teacherPlanNote.findFirst({
          where: { planType: 'homework_submission', planId: sub.id },
        })
        if (existing) continue
        const classId = hwIdToClassId.get(sub.homeworkId) ?? ''
        const note = (TEACHER_NOTES[classId] ?? [])[topicIdx] ?? 'Good effort this week — keep developing your analytical precision.'
        await prisma.teacherPlanNote.create({
          data: { planType: 'homework_submission', planId: sub.id, teacherId, schoolId, note },
        })
        await prisma.submission.update({ where: { id: sub.id }, data: { teacherReviewed: true } })
        submissionsReviewed++
      }
    } catch (err) { console.error('[demo-advance] D.2 teacher reviews:', err) }
  }

  // ── D.3: Raise a SEND concern for the lowest-scoring SEND student this week ───
  if (senco && phaseDHwIds.length > 0) {
    try {
      const sendSubs = await prisma.submission.findMany({
        where: {
          homeworkId: { in: phaseDHwIds }, schoolId, finalScore: { not: null },
          student: { sendStatus: { activeStatus: { not: 'NONE' } } },
        },
        select: { studentId: true, finalScore: true, homeworkId: true },
        orderBy: { finalScore: 'asc' },
      })
      const lowest = sendSubs[0]
      if (lowest) {
        const existing = await prisma.sendConcern.findFirst({
          where: { schoolId, studentId: lowest.studentId, createdAt: { gte: monday } },
        })
        if (!existing) {
          const hwEntry = [...newHwMap.values()].find(v => v.hwId === lowest.homeworkId)
          const pct     = Math.round(((lowest.finalScore ?? 0) / 5) * 100)
          await prisma.sendConcern.create({
            data: {
              schoolId,
              studentId:    lowest.studentId,
              raisedBy:     senco.id,
              source:       'system',
              category:     'literacy',
              description:  `Early warning: student scored ${lowest.finalScore}/5 (${pct}%) on "${hwEntry?.title ?? "this week's homework"}". Performance is below expected level for their SEND profile. Review ILP targets and consider adjusting support strategies.`,
              evidenceNotes: 'Auto-flagged by weekly performance monitoring.',
              status:       'open',
            },
          })
          concernsRaised++
        }
      }
    } catch (err) { console.error('[demo-advance] D.3 SEND concern:', err) }
  }

  // ── D.4: Parent→teacher weekly check-in message ───────────────────────────────
  if (demoParent) {
    try {
      const PARENT_MESSAGES = [
        "Hi Mr Patel, just checking in on Alex's progress. The An Inspector Calls context work looks challenging but Alex is engaging with it at home — any revision tips would be welcome.",
        "Hello, Alex wasn't sure about the dramatic 'unities' from this week's homework. Would a revision guide or model paragraph be possible? Thank you.",
        "Hi Mr Patel, Alex found the responsibility theme work really interesting this week. Is there anything extra we can do at home to support GCSE preparation?",
        "Hello, just a quick message — Alex mentioned the Inspector's role homework and seemed genuinely engaged. Please let us know if there are any concerns.",
        "Hi, wondering if you could share any feedback on Alex's recent homework. We're keen to support at home as the GCSE year progresses.",
        "Hello Mr Patel, wanted to say Alex is working hard on the essay planning this week. Any model answers or mark scheme guidance for home use would be brilliant.",
      ]
      const alreadySent = await prisma.msgMessage.findFirst({
        where: { senderId: demoParent.id, sentAt: { gte: monday }, thread: { schoolId } },
      })
      if (!alreadySent) {
        // Find or create a thread between parent and teacher
        const parentThreads = await prisma.msgThread.findMany({
          where: { schoolId, participants: { some: { userId: demoParent.id } } },
          select: { id: true, participants: { select: { userId: true } } },
        })
        const shared = parentThreads.find(t => t.participants.some(p => p.userId === teacherId))
        const threadId = shared?.id ?? (await prisma.msgThread.create({
          data: {
            schoolId,
            subject:    'Year 9 English — Alex Hughes',
            context:    'general',
            createdBy:  demoParent.id,
            participants: { create: [{ userId: demoParent.id }, { userId: teacherId }] },
          },
        })).id
        await prisma.msgMessage.create({
          data: { threadId, senderId: demoParent.id, body: PARENT_MESSAGES[topicIdx] ?? PARENT_MESSAGES[0] },
        })
        messagesAdded++
      }
    } catch (err) { console.error('[demo-advance] D.4 parent message:', err) }
  }

  // ── D.5: Positive behaviour record for the top scorer this week ──────────────
  if (phaseDHwIds.length > 0) {
    try {
      const topSub = await prisma.submission.findFirst({
        where: { homeworkId: { in: phaseDHwIds }, schoolId, finalScore: { not: null } },
        orderBy: { finalScore: 'desc' },
        select: { studentId: true },
      })
      if (topSub) {
        const existing = await prisma.behaviourRecord.findFirst({
          where: { schoolId, studentId: topSub.studentId, type: 'positive', recordDate: { gte: monday } },
        })
        if (!existing) {
          const BEHAVIOUR_DESCRIPTIONS = [
            'Excellent effort on this week\'s English homework — demonstrated thorough engagement with the historical context. A credit to the class.',
            'Outstanding analytical thinking shown in this week\'s homework submission — highly impressive level of structural awareness.',
            'Impressive depth of textual evidence in this week\'s homework — clearly working hard with the material outside of lessons.',
            'Exceptional commitment to English this week — the response showed real sophistication of argument and evidence selection.',
            'Brilliant character analysis in this week\'s homework — exactly the level of precision expected at GCSE.',
            'Superb language analysis this week — the kind of precision that distinguishes Grade 7+ responses. Well done.',
          ]
          await prisma.behaviourRecord.create({
            data: {
              schoolId,
              studentId:   topSub.studentId,
              authorId:    teacherId,
              type:        'positive',
              category:    'academic',
              description: BEHAVIOUR_DESCRIPTIONS[topicIdx] ?? BEHAVIOUR_DESCRIPTIONS[0],
              points:      2,
            },
          })
          behaviourLogged++
        }
      }
    } catch (err) { console.error('[demo-advance] D.5 behaviour record:', err) }
  }

  // ── D.6: Progress/close old SEND concerns ────────────────────────────────────
  // 7–14 days old open → under_review; 14+ days old open/under_review → closed
  try {
    const oneWeekAgo  = new Date(Date.now() - 7  * 86_400_000)
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000)
    const [r1, r2] = await Promise.all([
      prisma.sendConcern.updateMany({
        where: { schoolId, status: 'open', createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } },
        data: { status: 'under_review' },
      }),
      prisma.sendConcern.updateMany({
        where: { schoolId, status: { in: ['open', 'under_review'] }, createdAt: { lt: twoWeeksAgo } },
        data: { status: 'closed', reviewedAt: new Date(), reviewNotes: 'Concern reviewed and closed following monitoring period.' },
      }),
    ])
    concernsProgressed = r1.count + r2.count
  } catch (err) { console.error('[demo-advance] D.6 concern progress:', err) }

  // ── D.7: Mark notifications older than 3 days as read ────────────────────────
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)
    const result = await prisma.notification.updateMany({
      where: { schoolId, read: false, createdAt: { lt: threeDaysAgo } },
      data: { read: true },
    })
    notificationsCleared = result.count
  } catch (err) { console.error('[demo-advance] D.7 notifications:', err) }

  // ── D.8: TA notes for SEND students ──────────────────────────────────────────
  const TA_NOTES = [
    'Alex engaged well in this session — used scaffolding cards effectively for the context task. Will monitor independent working in the next lesson.',
    'Checked in during group work — Alex needed prompting to begin but showed good understanding once started. Shared sentence frames for the analytical paragraph.',
    'Alex made good progress on the responsibility question with TA support. Read-aloud strategy is helping — recommend continuing at home.',
    'Quiet session but Alex responded well to one-to-one check-in. Breaking the essay task into steps was effective. Model answers reviewed together.',
    "Alex's confidence in class discussion is improving. Reminded to use the point–evidence–explain structure — applied it independently in last 10 minutes.",
    'Alex completed the language analysis task with minimal prompts. Highlighted two key quotations independently — a real step forward.',
  ]
  if (ta) {
    try {
      const sendStudents = await prisma.sendStatus.findMany({
        where: { student: { schoolId }, activeStatus: { not: 'NONE' } },
        select: { studentId: true },
      })
      for (const { studentId } of sendStudents) {
        const exists = await prisma.taNote.findFirst({
          where: { schoolId, studentId, authorId: ta.id, createdAt: { gte: monday } },
        })
        if (exists) continue
        await prisma.taNote.create({
          data: {
            schoolId,
            studentId,
            authorId:  ta.id,
            content:   TA_NOTES[topicIdx] ?? TA_NOTES[0]!,
            isUrgent:  false,
          },
        })
        taNotesAdded++
      }
    } catch (err) { console.error('[demo-advance] D.8 TA notes:', err) }
  }

  // ── D.9: Direct ILP evidence entries for SEND students ───────────────────────
  // Guarantees the ILP evidence timeline grows regardless of Haiku API availability
  try {
    for (const [, { hwId, title: hwTitle, subject: hwSubject }] of newHwMap.entries()) {
      for (const [studentId, targets] of sendIlpMap.entries()) {
        const firstTarget = targets[0]
        if (!firstTarget) continue
        const sub = await prisma.submission.findFirst({
          where: { homeworkId: hwId, studentId, schoolId },
          select: { id: true, finalScore: true },
        })
        if (!sub) continue
        const score       = sub.finalScore ?? 0
        const evidenceType = score >= 4 ? 'PROGRESS' : score <= 1 ? 'CONCERN' : 'NEUTRAL'
        try {
          await prisma.ilpEvidenceEntry.create({
            data: {
              schoolId,
              studentId,
              ilpTargetId:   firstTarget.id,
              submissionId:  sub.id,
              homeworkTitle: hwTitle,
              subject:       hwSubject,
              score,
              maxScore:      5,
              evidenceType,
              autoLinked:    true,
              createdBy:     teacherId,
            },
          })
          ilpEntriesLinked++
        } catch { /* unique constraint — already linked */ }
      }
    }
  } catch (err) { console.error('[demo-advance] D.9 ILP evidence:', err) }

  // ── D.10: Negative behaviour record for lowest-scoring non-SEND student ───────
  if (phaseDHwIds.length > 0) {
    try {
      const allSubs = await prisma.submission.findMany({
        where: { homeworkId: { in: phaseDHwIds }, schoolId, finalScore: { not: null } },
        select: {
          studentId: true, finalScore: true,
          student: { select: { sendStatus: { select: { activeStatus: true } } } },
        },
        orderBy: { finalScore: 'asc' },
      })
      const lowestNonSend = allSubs.find(
        s => !s.student.sendStatus?.activeStatus || s.student.sendStatus.activeStatus === 'NONE'
      )
      if (lowestNonSend) {
        const existingNeg = await prisma.behaviourRecord.findFirst({
          where: { schoolId, studentId: lowestNonSend.studentId, type: 'negative', recordDate: { gte: monday } },
        })
        if (!existingNeg) {
          const NEGATIVE_DESCRIPTIONS = [
            'Homework submitted late this week — consistent effort with the context material is essential for exam success.',
            'Homework completion was below standard this week. Please review the structural analysis notes and resubmit key points.',
            'Incomplete homework submission this week. A full attempt at the responsibility question is needed before the next lesson.',
            'Homework not completed to the required standard. Please revisit the Inspector analysis and ensure all questions are attempted.',
            'Late submission this week — the character arc essay plan was due on Friday. Please ensure deadlines are met going forward.',
            'Below-standard homework this week. The language analysis task needs a full attempt; use the SLAP technique for structure.',
          ]
          await prisma.behaviourRecord.create({
            data: {
              schoolId,
              studentId:   lowestNonSend.studentId,
              authorId:    teacherId,
              type:        'negative',
              category:    'homework',
              description: NEGATIVE_DESCRIPTIONS[topicIdx] ?? NEGATIVE_DESCRIPTIONS[0]!,
              points:      -1,
            },
          })
          negativeBehaviourLogged++
        }
      }
    } catch (err) { console.error('[demo-advance] D.10 negative behaviour:', err) }
  }

  // ── D.11: Mark old parent communication receipts as read ─────────────────────
  if (demoParent) {
    try {
      const oneDayAgo = new Date(Date.now() - 86_400_000)
      const result = await prisma.communicationReceipt.updateMany({
        where: { parentId: demoParent.id, readAt: null, createdAt: { lt: oneDayAgo } },
        data: { readAt: new Date() },
      })
      receiptsMarkedRead = result.count
    } catch (err) { console.error('[demo-advance] D.11 receipts:', err) }
  }

  // ── D.12: Teacher reply to parent message (~1 day after parent sent) ─────────
  const TEACHER_REPLIES = [
    'Thanks for your message. Alex is showing real promise with the context material — the key is connecting context to specific quotations in each paragraph. I\'ll keep you updated on progress.',
    'Many thanks for getting in touch. The dramatic unities can be tricky — I\'d recommend the GCSE revision guide for a clear breakdown. Happy to discuss further at the next parents\' evening.',
    'Thank you for your message. Alex\'s engagement with the responsibility theme is very encouraging. Asking "why does the author include this?" when reading at home really develops analytical thinking.',
    'Thanks for checking in. Alex is making good progress. A calm 20-minute revision slot each evening — even just re-reading class notes — makes a real difference at GCSE level.',
    'Thank you — Alex\'s efforts are genuinely reflected in the work. I\'ll share detailed feedback directly on the homework so Alex can see exactly where the strengths lie.',
    'Many thanks for your message. I\'ll share a model paragraph structure in the next lesson. One analytical paragraph a day as home practice would be excellent preparation for the exam.',
  ]
  if (demoParent) {
    try {
      const parentThreads = await prisma.msgThread.findMany({
        where: { schoolId, participants: { some: { userId: demoParent.id } } },
        select: { id: true, participants: { select: { userId: true } } },
      })
      const shared = parentThreads.find(t => t.participants.some(p => p.userId === teacherId))
      if (shared) {
        const lastParentMsg = await prisma.msgMessage.findFirst({
          where: { threadId: shared.id, senderId: demoParent.id },
          orderBy: { sentAt: 'desc' },
          select: { sentAt: true },
        })
        if (lastParentMsg) {
          const replied = await prisma.msgMessage.findFirst({
            where: { threadId: shared.id, senderId: teacherId, sentAt: { gt: lastParentMsg.sentAt } },
          })
          if (!replied) {
            const replyAt = new Date(lastParentMsg.sentAt.getTime() + 23 * 3600_000)
            await prisma.msgMessage.create({
              data: {
                threadId: shared.id,
                senderId: teacherId,
                body:     TEACHER_REPLIES[topicIdx] ?? TEACHER_REPLIES[0]!,
                sentAt:   replyAt,
              },
            })
            teacherRepliesAdded++
          }
        }
      }
    } catch (err) { console.error('[demo-advance] D.12 teacher reply:', err) }
  }

  // ── D.13: Update active APDR Do section with aggregated evidence ──────────────
  try {
    const activeApdr = await prisma.assessPlanDoReview.findFirst({
      where: { schoolId, status: 'ACTIVE' },
      select: { id: true, studentId: true, createdAt: true },
    })
    if (activeApdr) {
      const [evidenceEntries, taNotes] = await Promise.all([
        prisma.ilpEvidenceEntry.findMany({
          where: { schoolId, studentId: activeApdr.studentId, createdAt: { gte: activeApdr.createdAt } },
          select: { homeworkTitle: true, evidenceType: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.taNote.findMany({
          where: { schoolId, studentId: activeApdr.studentId, createdAt: { gte: activeApdr.createdAt } },
          select: { content: true, createdAt: true, isUrgent: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ])
      if (evidenceEntries.length > 0 || taNotes.length > 0) {
        const lines: string[] = ['Evidence gathered this cycle:']
        if (evidenceEntries.length > 0) {
          lines.push('\nHomework evidence:')
          for (const e of evidenceEntries) {
            const label = e.evidenceType === 'PROGRESS' ? '✓ Progress' : e.evidenceType === 'CONCERN' ? '⚠ Concern' : '– Neutral'
            lines.push(`• ${label}: ${e.homeworkTitle} (${e.createdAt.toLocaleDateString('en-GB')})`)
          }
        }
        if (taNotes.length > 0) {
          lines.push('\nTA observations:')
          for (const n of taNotes) {
            const urgent = n.isUrgent ? ' [URGENT]' : ''
            lines.push(`• ${n.createdAt.toLocaleDateString('en-GB')}${urgent}: ${n.content.slice(0, 120)}${n.content.length > 120 ? '…' : ''}`)
          }
        }
        await prisma.assessPlanDoReview.update({
          where: { id: activeApdr.id },
          data:  { doContent: lines.join('\n') },
        })
        apdrUpdated++
      }
    }
  } catch (err) { console.error('[demo-advance] D.13 APDR do section:', err) }

  // ── D.14: Revision session for demo student (a.hughes) ───────────────────────
  const REVISION_NOTES = [
    'Revised Edwardian context — used flashcard method, felt confident on key dates and class hierarchy.',
    'Worked through dramatic structure notes — the unities concept is now much clearer after drawing a timeline.',
    'Revised responsibility theme — created a spider diagram linking characters to their moral responses.',
    "Re-read the Inspector's final speech — annotated key phrases and practised explaining Priestley's purpose.",
    "Studied Sheila's character arc — timed response plan completed in 10 minutes, good progress.",
    'Reviewed the ending and its ambiguity — drafted an evaluative paragraph; feeling more confident on exam approach.',
  ]
  if (demoStudent) {
    try {
      let exam = await prisma.revisionExam.findFirst({
        where: { studentId: demoStudent.id, subject: 'English Literature' },
      })
      if (!exam) {
        exam = await prisma.revisionExam.create({
          data: {
            studentId:    demoStudent.id,
            subject:      'English Literature',
            examBoard:    'AQA',
            paperName:    'Paper 2: Modern Texts and Poetry',
            examDate:     new Date(Date.UTC(2027, 4, 20, 9, 0, 0)), // 20 May 2027
            durationMins: 105,
          },
        })
      }
      const existingSession = await prisma.revisionSession.findFirst({
        where: { studentId: demoStudent.id, scheduledAt: { gte: monday } },
      })
      if (!existingSession) {
        // Wednesday 4pm of the current school week
        const sessionAt = new Date(monday)
        sessionAt.setDate(monday.getDate() + 2)
        sessionAt.setHours(16, 0, 0, 0)
        await prisma.revisionSession.create({
          data: {
            studentId:    demoStudent.id,
            examId:       exam.id,
            subject:      'English Literature',
            topic:        (AIC_POOL[topicIdx]?.topic ?? 'An Inspector Calls').split(':')[0].trim(),
            scheduledAt:  sessionAt,
            durationMins: 45,
            status:       'completed',
            confidence:   topicIdx % 3 === 0 ? 3 : topicIdx % 3 === 1 ? 4 : 3,
            notes:        REVISION_NOTES[topicIdx] ?? REVISION_NOTES[0]!,
          },
        })
        revisionSessionsAdded++
      }
    } catch (err) { console.error('[demo-advance] D.14 revision session:', err) }
  }

  console.log(`[demo-advance] slidesHealed=${slidesHealed} slidesSkipped=${slidesSkipped} lessonsCreated=${lessonsCreated} hwCreated=${hwCreated} hwSkipped=${hwSkipped} subsCreated=${subsCreated} insightsReviewed=${insightsReviewed} submissionsReviewed=${submissionsReviewed} concernsRaised=${concernsRaised} messagesAdded=${messagesAdded} behaviourLogged=${behaviourLogged} concernsProgressed=${concernsProgressed} notificationsCleared=${notificationsCleared} taNotesAdded=${taNotesAdded} ilpEntriesLinked=${ilpEntriesLinked} negativeBehaviourLogged=${negativeBehaviourLogged} receiptsMarkedRead=${receiptsMarkedRead} teacherRepliesAdded=${teacherRepliesAdded} apdrUpdated=${apdrUpdated} revisionSessionsAdded=${revisionSessionsAdded}`)

  return NextResponse.json({
    ok: true,
    slidesHealed,
    slidesSkipped,
    lessonsCreated,
    hwCreated,
    hwSkipped,
    subsCreated,
    insightsReviewed,
    submissionsReviewed,
    concernsRaised,
    messagesAdded,
    behaviourLogged,
    concernsProgressed,
    notificationsCleared,
    taNotesAdded,
    ilpEntriesLinked,
    negativeBehaviourLogged,
    receiptsMarkedRead,
    teacherRepliesAdded,
    apdrUpdated,
    revisionSessionsAdded,
  })
}
