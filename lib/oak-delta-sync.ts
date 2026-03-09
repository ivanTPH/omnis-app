/**
 * lib/oak-delta-sync.ts
 *
 * Core delta-sync logic callable from:
 *   - app/api/cron/oak-sync/route.ts  (uses shared prisma from lib/prisma.ts)
 *   - scripts/oak-delta-sync.ts       (standalone version with direct-URL client)
 */

import { prisma } from '@/lib/prisma'

// ─── Config ───────────────────────────────────────────────────────────────────

const OAK_BASE           = 'https://www.thenational.academy'
const UNIT_CONCURRENCY   = 4
const LESSON_CONCURRENCY = 6

// ─── Public types ─────────────────────────────────────────────────────────────

export type DeltaSyncCounts = {
  newSubjects:     number
  updatedSubjects: number
  deletedSubjects: number
  newUnits:        number
  updatedUnits:    number
  deletedUnits:    number
  newLessons:      number
  updatedLessons:  number
  deletedLessons:  number
  errorCount:      number
  errors:          { slug: string; message: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson(url: string, retries = 3): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Omnis-Oak-DeltaSync/1.0' } })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === retries) throw err
      await sleep(attempt * 800)
    }
  }
  throw new Error('fetchJson: exhausted retries')
}

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
}

// ─── Sitemap + programme parsing ──────────────────────────────────────────────

type LessonEntry = { programmeSlug: string; unitSlug: string; lessonSlug: string }

async function getBuildId(): Promise<string> {
  const html  = await fetch(OAK_BASE).then(r => r.text())
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (!match) throw new Error('Could not find buildId in Oak homepage HTML')
  return match[1]
}

async function getLessonEntries(): Promise<LessonEntry[]> {
  const xml     = await fetch(`${OAK_BASE}/teachers/sitemap-1.xml`).then(r => r.text())
  const pattern = /\/teachers\/programmes\/([^/]+)\/units\/([^/]+)\/lessons\/([^/<]+)/g
  const entries: LessonEntry[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(xml)) !== null) {
    entries.push({ programmeSlug: m[1], unitSlug: m[2], lessonSlug: m[3] })
  }
  return Array.from(new Map(entries.map(e => [e.lessonSlug, e])).values())
}

type ProgrammeMeta = {
  programmeSlug: string; subjectSlug: string; phase: string
  keystage: string; examBoard: string | null; tier: string | null; isLegacy: boolean
}

const KS_PHASES: Record<string, string> = {
  ks1: 'primary', ks2: 'primary', ks3: 'secondary', ks4: 'secondary',
  'early-years-foundation-stage': 'primary',
}
const EXAM_BOARDS = new Set(['aqa', 'edexcel', 'edexcelb', 'ocr', 'wjec', 'eduqas', 'pearson'])
const TIERS       = new Set(['foundation', 'higher'])

const SUBJECT_TITLES: Record<string, string> = {
  'art': 'Art and design', 'biology': 'Biology', 'chemistry': 'Chemistry',
  'citizenship': 'Citizenship', 'combined-science': 'Combined science',
  'computing': 'Computing', 'cooking-nutrition': 'Cooking and nutrition',
  'design-technology': 'Design and technology', 'drama': 'Drama', 'english': 'English',
  'financial-education': 'Financial education', 'french': 'French', 'geography': 'Geography',
  'german': 'German', 'history': 'History', 'latin': 'Latin', 'literacy': 'Literacy',
  'maths': 'Maths', 'music': 'Music', 'physical-education': 'Physical education',
  'physics': 'Physics', 'religious-education': 'Religious education',
  'rshe-pshe': 'RSHE (PSHE)', 'science': 'Science', 'spanish': 'Spanish',
  'expressive-arts-and-design': 'Expressive arts and design',
  'personal-social-and-emotional-development': 'Personal, social and emotional development',
  'understanding-the-world': 'Understanding the world',
}

function parseProgrammeSlug(slug: string): ProgrammeMeta {
  const isLegacy    = slug.endsWith('-l')
  const base        = isLegacy ? slug.slice(0, -2) : slug
  const parts       = base.split('-')
  const ksIdx       = parts.findIndex(p => /^ks[1-4]$/.test(p))
  const keystage    = ksIdx >= 0 ? parts[ksIdx] : 'early-years-foundation-stage'
  const phase       = KS_PHASES[keystage] ?? 'primary'
  const phaseIdx    = parts.findIndex(p => p === 'primary' || p === 'secondary' || p === 'foundation')
  const subjectSlug = phaseIdx > 0 ? parts.slice(0, phaseIdx).join('-') : parts[0]
  const after       = ksIdx >= 0 ? parts.slice(ksIdx + 1) : []
  return {
    programmeSlug: slug, subjectSlug, phase, keystage,
    examBoard: after.find(p => EXAM_BOARDS.has(p)) ?? null,
    tier:      after.find(p => TIERS.has(p)) ?? null,
    isLegacy,
  }
}

// ─── Unit sync ────────────────────────────────────────────────────────────────

type OakUnitListItem = {
  slug: string; title: string; programmeSlug: string; keyStageSlug: string
  subjectSlug: string; year?: string | number | null; unitStudyOrder?: number
  lessonCount?: number; subjectCategories?: unknown[]; learningThemes?: unknown[]
}

async function syncUnitsForProgramme(
  buildId: string, meta: ProgrammeMeta,
  unitSlugsNeeded: Set<string>, counts: DeltaSyncCounts, syncedAt: Date,
): Promise<void> {
  const url  = `${OAK_BASE}/_next/data/${buildId}/teachers/programmes/${meta.programmeSlug}/units.json`
  const data = await fetchJson(url) as { pageProps?: { curriculumData?: { units?: OakUnitListItem[][] } } } | null
  if (!data) return

  const allUnits: OakUnitListItem[] =
    ((data?.pageProps?.curriculumData?.units ?? []) as unknown[]).flat() as OakUnitListItem[]

  for (const unit of allUnits) {
    if (!unit.slug || !unitSlugsNeeded.has(unit.slug)) continue
    try {
      const existing = await prisma.oakUnit.findUnique({ where: { slug: unit.slug } })
      const changed  = existing && existing.title !== unit.title
      await prisma.oakUnit.upsert({
        where:  { slug: unit.slug },
        create: {
          slug: unit.slug, title: unit.title, subjectSlug: meta.subjectSlug,
          keystage: meta.keystage, yearGroup: unit.year ? parseInt(String(unit.year), 10) : null,
          examBoard: meta.examBoard, tier: meta.tier, programmeSlug: meta.programmeSlug,
          orderInProgramme: unit.unitStudyOrder ?? 0, plannedLessonCount: unit.lessonCount ?? 0,
          isLegacy: meta.isLegacy, subjectCategories: (unit.subjectCategories ?? []) as object[],
          threads: (unit.learningThemes ?? []) as object[], lastSeenAt: syncedAt,
        },
        update: {
          title: unit.title, yearGroup: unit.year ? parseInt(String(unit.year), 10) : null,
          examBoard: meta.examBoard, tier: meta.tier,
          orderInProgramme: unit.unitStudyOrder ?? 0, plannedLessonCount: unit.lessonCount ?? 0,
          subjectCategories: (unit.subjectCategories ?? []) as object[],
          threads: (unit.learningThemes ?? []) as object[], lastSeenAt: syncedAt, deletedAt: null,
        },
      })
      if (!existing) counts.newUnits++
      else if (changed) counts.updatedUnits++
    } catch {
      // Concurrent upsert collision — safe to ignore
    }
  }
}

// ─── Lesson sync ──────────────────────────────────────────────────────────────

type OakLessonDetail = {
  lessonSlug: string; lessonTitle: string; unitSlug: string; subjectSlug: string
  keyStageSlug: string; year?: string | number | null; examBoardSlug?: string | null
  tierSlug?: string | null; orderInUnit?: number; pupilLessonOutcome?: string | null
  keyLearningPoints?: unknown[]; lessonKeywords?: unknown[]; lessonOutline?: unknown[]
  starterQuiz?: unknown[]; exitQuiz?: unknown[]; misconceptionsAndCommonMistakes?: unknown[]
  teacherTips?: unknown[]; contentGuidance?: unknown[]; supervisionLevel?: string | null
  videoMuxPlaybackId?: string | null; videoWithSignLanguageMuxPlaybackId?: string | null
  transcriptSentences?: string[]; worksheetUrl?: string | null; presentationUrl?: string | null
  subjectCategories?: unknown[]; isLegacy?: boolean; expired?: boolean; loginRequired?: boolean
  downloads?: { type: string; label?: string; ext?: string; exists: boolean }[]
}

async function syncOneLesson(
  buildId: string, entry: LessonEntry, counts: DeltaSyncCounts, syncedAt: Date,
): Promise<void> {
  const url  = `${OAK_BASE}/_next/data/${buildId}/teachers/lessons/${entry.lessonSlug}.json`
  const data = await fetchJson(url) as { pageProps?: { lesson?: OakLessonDetail } } | null
  if (!data) return

  const lesson = data?.pageProps?.lesson
  if (!lesson?.lessonSlug) return

  const yearGroup = lesson.year ? parseInt(String(lesson.year), 10) : null
  const existing  = await prisma.oakLesson.findUnique({ where: { slug: lesson.lessonSlug } })
  const changed   = existing && (
    existing.title             !== lesson.lessonTitle ||
    existing.pupilLessonOutcome !== (lesson.pupilLessonOutcome ?? null) ||
    existing.expired            !== (lesson.expired ?? false)
  )

  await prisma.oakLesson.upsert({
    where:  { slug: lesson.lessonSlug },
    create: {
      slug: lesson.lessonSlug, title: lesson.lessonTitle, unitSlug: entry.unitSlug,
      subjectSlug: lesson.subjectSlug, keystage: lesson.keyStageSlug, yearGroup,
      examBoard: lesson.examBoardSlug ?? null, tier: lesson.tierSlug ?? null,
      orderInUnit: lesson.orderInUnit ?? 0,
      pupilLessonOutcome: lesson.pupilLessonOutcome ?? null,
      keyLearningPoints:  (lesson.keyLearningPoints  ?? []) as object[],
      lessonKeywords:     (lesson.lessonKeywords      ?? []) as object[],
      lessonOutline:      (lesson.lessonOutline       ?? []) as object[],
      starterQuiz:        (lesson.starterQuiz         ?? []) as object[],
      exitQuiz:           (lesson.exitQuiz            ?? []) as object[],
      misconceptionsAndCommonMistakes: (lesson.misconceptionsAndCommonMistakes ?? []) as object[],
      teacherTips:        (lesson.teacherTips         ?? []) as object[],
      contentGuidance:    (lesson.contentGuidance     ?? []) as object[],
      supervisionLevel:   lesson.supervisionLevel ?? null,
      videoMuxPlaybackId: lesson.videoMuxPlaybackId ?? null,
      videoWithSignLanguageMuxPlaybackId: lesson.videoWithSignLanguageMuxPlaybackId ?? null,
      transcriptSentences: (lesson.transcriptSentences ?? []) as string[],
      worksheetUrl: lesson.worksheetUrl ?? null, presentationUrl: lesson.presentationUrl ?? null,
      subjectCategories: (lesson.subjectCategories ?? []) as object[],
      isLegacy: lesson.isLegacy ?? false, expired: lesson.expired ?? false,
      loginRequired: lesson.loginRequired ?? false, lastSeenAt: syncedAt,
    },
    update: {
      title: lesson.lessonTitle, unitSlug: entry.unitSlug, yearGroup,
      examBoard: lesson.examBoardSlug ?? null, tier: lesson.tierSlug ?? null,
      orderInUnit: lesson.orderInUnit ?? 0,
      pupilLessonOutcome: lesson.pupilLessonOutcome ?? null,
      keyLearningPoints:  (lesson.keyLearningPoints  ?? []) as object[],
      lessonKeywords:     (lesson.lessonKeywords      ?? []) as object[],
      lessonOutline:      (lesson.lessonOutline       ?? []) as object[],
      starterQuiz:        (lesson.starterQuiz         ?? []) as object[],
      exitQuiz:           (lesson.exitQuiz            ?? []) as object[],
      misconceptionsAndCommonMistakes: (lesson.misconceptionsAndCommonMistakes ?? []) as object[],
      teacherTips:        (lesson.teacherTips         ?? []) as object[],
      contentGuidance:    (lesson.contentGuidance     ?? []) as object[],
      supervisionLevel:   lesson.supervisionLevel ?? null,
      videoMuxPlaybackId: lesson.videoMuxPlaybackId ?? null,
      videoWithSignLanguageMuxPlaybackId: lesson.videoWithSignLanguageMuxPlaybackId ?? null,
      transcriptSentences: (lesson.transcriptSentences ?? []) as string[],
      worksheetUrl: lesson.worksheetUrl ?? null, presentationUrl: lesson.presentationUrl ?? null,
      subjectCategories: (lesson.subjectCategories ?? []) as object[],
      expired: lesson.expired ?? false, loginRequired: lesson.loginRequired ?? false,
      lastSeenAt: syncedAt, deletedAt: null,
    },
  })

  for (const dl of lesson.downloads ?? []) {
    await prisma.oakResource.upsert({
      where:  { lessonSlug_type: { lessonSlug: lesson.lessonSlug, type: dl.type } },
      create: { type: dl.type, label: dl.label ?? null, ext: dl.ext ?? null, exists: dl.exists ?? true, lesson: { connect: { slug: lesson.lessonSlug } } },
      update: { label: dl.label ?? null, ext: dl.ext ?? null, exists: dl.exists ?? true },
    })
  }

  if (!existing) counts.newLessons++
  else if (changed) counts.updatedLessons++
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function runDeltaSync(): Promise<{ counts: DeltaSyncCounts; durationMs: number }> {
  const startTime = Date.now()
  const syncedAt  = new Date()

  const syncLog = await prisma.oakSyncLog.create({
    data: { type: 'delta', status: 'running' },
  })

  const counts: DeltaSyncCounts = {
    newSubjects: 0, updatedSubjects: 0, deletedSubjects: 0,
    newUnits: 0, updatedUnits: 0, deletedUnits: 0,
    newLessons: 0, updatedLessons: 0, deletedLessons: 0,
    errorCount: 0, errors: [],
  }

  try {
    const buildId = await getBuildId()
    const entries = await getLessonEntries()

    const programmeMap     = new Map<string, ProgrammeMeta>()
    const seenSubjectSlugs = new Set<string>()
    const seenUnitSlugs    = new Set<string>()
    const seenLessonSlugs  = new Set<string>()

    for (const e of entries) {
      if (!programmeMap.has(e.programmeSlug)) {
        programmeMap.set(e.programmeSlug, parseProgrammeSlug(e.programmeSlug))
      }
      seenUnitSlugs.add(e.unitSlug)
      seenLessonSlugs.add(e.lessonSlug)
    }
    for (const meta of programmeMap.values()) seenSubjectSlugs.add(meta.subjectSlug)

    const programmes     = Array.from(programmeMap.values())
    const uniqueSubjects = Array.from(new Map(programmes.map(p => [p.subjectSlug, p])).values())

    // Subjects
    for (const meta of uniqueSubjects) {
      const existing = await prisma.oakSubject.findUnique({ where: { slug: meta.subjectSlug } })
      await prisma.oakSubject.upsert({
        where:  { slug: meta.subjectSlug },
        create: { slug: meta.subjectSlug, title: SUBJECT_TITLES[meta.subjectSlug] ?? meta.subjectSlug, phase: meta.phase, lastSeenAt: syncedAt },
        update: { phase: meta.phase, lastSeenAt: syncedAt, deletedAt: null },
      })
      if (!existing) counts.newSubjects++
    }
    const dsResult = await prisma.oakSubject.updateMany({
      where: { slug: { notIn: Array.from(seenSubjectSlugs) }, deletedAt: null },
      data:  { deletedAt: syncedAt },
    })
    counts.deletedSubjects = dsResult.count

    // Units
    await withConcurrency(programmes, UNIT_CONCURRENCY, async (meta) => {
      try {
        await syncUnitsForProgramme(buildId, meta, seenUnitSlugs, counts, syncedAt)
      } catch (err) {
        counts.errors.push({ slug: meta.programmeSlug, message: String(err) })
        counts.errorCount++
      }
    })
    const duResult = await prisma.oakUnit.updateMany({
      where: { slug: { notIn: Array.from(seenUnitSlugs) }, deletedAt: null },
      data:  { deletedAt: syncedAt },
    })
    counts.deletedUnits = duResult.count

    // Lessons
    await withConcurrency(entries, LESSON_CONCURRENCY, async (entry) => {
      try {
        await syncOneLesson(buildId, entry, counts, syncedAt)
      } catch (err) {
        counts.errors.push({ slug: entry.lessonSlug, message: String(err) })
        counts.errorCount++
      }
    })
    const dlResult = await prisma.oakLesson.updateMany({
      where: { slug: { notIn: Array.from(seenLessonSlugs) }, deletedAt: null },
      data:  { deletedAt: syncedAt },
    })
    counts.deletedLessons = dlResult.count

    const durationMs = Date.now() - startTime
    const status     = counts.errorCount > 0 ? 'partial' : 'completed'

    await prisma.oakSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status, completedAt: new Date(), durationMs,
        newSubjects: counts.newSubjects, updatedSubjects: counts.updatedSubjects, deletedSubjects: counts.deletedSubjects,
        newUnits: counts.newUnits, updatedUnits: counts.updatedUnits, deletedUnits: counts.deletedUnits,
        newLessons: counts.newLessons, updatedLessons: counts.updatedLessons, deletedLessons: counts.deletedLessons,
        errorCount: counts.errorCount, errors: counts.errors as object[],
      },
    })

    return { counts, durationMs }
  } catch (err) {
    const durationMs = Date.now() - startTime
    await prisma.oakSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed', completedAt: new Date(), durationMs,
        errorCount: 1, errors: [{ slug: 'FATAL', message: String(err) }] as object[],
      },
    })
    throw err
  }
}
