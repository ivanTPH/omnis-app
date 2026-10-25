/**
 * lib/oak-bulk-sync.ts
 *
 * Official Oak National Academy bulk sync via the Open API.
 * Replaces the fragile _next/data web-scraping approach.
 *
 * How it works:
 *   1. GET /api/v0/subjects           → list of 17 subject slugs
 *   2. POST /api/bulk {subjects:[…]}  → ZIP file per subject-phase
 *   3. Unzip + parse JSON             → sequence (units) + lessons array
 *   4. Upsert into DB                 → OakSubject, OakUnit, OakLesson
 *
 * ~17 API calls total (vs ~11,000 individual lesson requests in old scraper).
 * All data persisted in Supabase — zero extra cost on application requests.
 *
 * Schedule: Sunday 02:00 UTC (existing oak-sync cron in crons.yml).
 * Requires env var: OAK_API_KEY
 */

import { writeIfChanged } from '@/lib/sync/change-only'
import JSZip   from 'jszip'
import { prisma } from '@/lib/prisma'

const OAK_API_BASE = 'https://open-api.thenational.academy'

// ─── Subject title map (mirrors Oak's canonical names) ────────────────────────

const SUBJECT_TITLES: Record<string, string> = {
  'art':                    'Art and design',
  'citizenship':            'Citizenship',
  'computing':              'Computing',
  'cooking-nutrition':      'Cooking and nutrition',
  'design-technology':      'Design and technology',
  'english':                'English',
  'french':                 'French',
  'geography':              'Geography',
  'german':                 'German',
  'history':                'History',
  'maths':                  'Maths',
  'music':                  'Music',
  'physical-education':     'Physical education',
  'religious-education':    'Religious education',
  'rshe-pshe':              'RSHE (PSHE)',
  'science':                'Science',
  'spanish':                'Spanish',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type BulkUnitLesson = {
  lessonSlug:  string
  lessonTitle: string
  lessonOrder: number
  state:       string
}

type BulkUnit = {
  unitSlug:                    string
  unitTitle:                   string
  canonicalUrl:                string
  threads:                     { slug: string; order: number; title: string }[]
  priorKnowledgeRequirements:  string[]
  nationalCurriculumContent:   string[]
  description:                 string
  yearSlug:                    string
  year:                        number
  keyStageSlug:                string
  subjectSlug:                 string
  whyThisWhyNow?:              string
  unitLessons:                 BulkUnitLesson[]
  examSubjects?:               { subjectSlug: string; examBoardSlug: string }[]
}

type BulkLesson = {
  lessonTitle:                    string
  lessonSlug:                     string
  unitSlug:                       string
  unitTitle:                      string
  subjectSlug:                    string
  subjectTitle:                   string
  keyStageSlug:                   string
  keyStageTitle:                  string
  lessonKeywords:                 { keyword: string; description: string }[]
  keyLearningPoints:              { keyLearningPoint: string }[]
  misconceptionsAndCommonMistakes: { misconception: string; response: string }[]
  pupilLessonOutcome:             string
  teacherTips:                    { teacherTip: string }[]
  contentGuidance:                unknown[]
  downloadsavailable:             boolean
  supervisionLevel:               string | null
  transcript_sentences:           string   // full transcript as raw string
  transcript_vtt:                 string | null
  oakUrl:                         string
  canonicalUrl:                   string
}

type BulkData = {
  sequenceSlug: string
  subjectTitle: string
  sequence:     BulkUnit[]
  lessons:      BulkLesson[]
}

export type BulkSyncCounts = {
  subjectPhases:  number
  newSubjects:    number
  updatedSubjects: number
  newUnits:       number
  updatedUnits:   number
  newLessons:     number
  updatedLessons: number
  errorCount:     number
  errors:         { slug: string; message: string }[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.OAK_API_KEY
  if (!key) throw new Error('OAK_API_KEY environment variable not set')
  return key
}

/** Returns all subject slugs from the Oak API (e.g. ["english","maths","history",...]) */
async function getSubjectSlugs(): Promise<string[]> {
  const key = getApiKey()
  const res = await fetch(`${OAK_API_BASE}/api/v0/subjects`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`Oak subjects API: HTTP ${res.status}`)
  return res.json() as Promise<string[]>
}

/**
 * Downloads a bulk ZIP for {subjectPhase} (e.g. "english-secondary") and
 * returns the parsed JSON, or null if the phase doesn't exist for that subject.
 */
async function downloadAndParse(subjectPhase: string): Promise<BulkData | null> {
  const key = getApiKey()
  const res = await fetch(`${OAK_API_BASE}/api/bulk`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({ subjects: [subjectPhase] }),
  })
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) return null
    throw new Error(`Oak bulk API: HTTP ${res.status} for ${subjectPhase}`)
  }
  const buffer   = Buffer.from(await res.arrayBuffer())
  const zip      = await JSZip.loadAsync(buffer)
  const filename = `${subjectPhase}.json`
  const file     = zip.file(filename)
  if (!file) return null  // Only schema.json in ZIP → no secondary sequence
  const text = await file.async('string')
  return JSON.parse(text) as BulkData
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────

async function upsertSubject(
  subjectSlug: string,
  title:       string,
  syncedAt:    Date,
  counts:      BulkSyncCounts,
  prev:        Map<string, string | null>,
): Promise<void> {
  const existed = prev.has(subjectSlug)
  const wrote = await writeIfChanged(prev, subjectSlug,
    { slug: subjectSlug, title, phase: 'secondary', lastSeenAt: syncedAt },
    { title, phase: 'secondary', lastSeenAt: syncedAt, deletedAt: null },
    (create, update) => prisma.oakSubject.upsert({ where: { slug: subjectSlug }, create, update, select: { slug: true } }))
  if (!existed) counts.newSubjects++
  else if (wrote) counts.updatedSubjects++
}

async function upsertUnits(
  sequence:     BulkUnit[],
  subjectSlug:  string,
  sequenceSlug: string,
  syncedAt:     Date,
  counts:       BulkSyncCounts,
  prev:         Map<string, string | null>,
): Promise<void> {
  for (const unit of sequence) {
    try {
      const existed = prev.has(unit.unitSlug)
      const wrote = await writeIfChanged(prev, unit.unitSlug, {
          slug:             unit.unitSlug,
          title:            unit.unitTitle,
          subjectSlug,
          keystage:         unit.keyStageSlug,
          yearGroup:        unit.year ?? null,
          examBoard:        null,
          tier:             null,
          programmeSlug:    sequenceSlug,
          description:      unit.description ?? null,
          whyThisWhyNow:    unit.whyThisWhyNow ?? null,
          priorKnowledgeRequirements: unit.priorKnowledgeRequirements as unknown as object[],
          nationalCurriculumContent:  unit.nationalCurriculumContent  as unknown as object[],
          threads:          unit.threads          as object[],
          subjectCategories: [],
          orderInProgramme: 0,
          plannedLessonCount: unit.unitLessons?.filter(l => l.state === 'published').length ?? 0,
          isLegacy:         false,
          lastSeenAt:       syncedAt,
        }, {
          title:            unit.unitTitle,
          keystage:         unit.keyStageSlug,
          yearGroup:        unit.year ?? null,
          programmeSlug:    sequenceSlug,
          description:      unit.description ?? null,
          whyThisWhyNow:    unit.whyThisWhyNow ?? null,
          priorKnowledgeRequirements: unit.priorKnowledgeRequirements as unknown as object[],
          nationalCurriculumContent:  unit.nationalCurriculumContent  as unknown as object[],
          threads:          unit.threads          as object[],
          plannedLessonCount: unit.unitLessons?.filter(l => l.state === 'published').length ?? 0,
          lastSeenAt:       syncedAt,
          deletedAt:        null,
        },
        (create, update) => prisma.oakUnit.upsert({ where: { slug: unit.unitSlug }, create, update, select: { slug: true } }))
      if (!existed) counts.newUnits++
      else if (wrote) counts.updatedUnits++
    } catch (err) {
      counts.errors.push({ slug: unit.unitSlug, message: String(err) })
      counts.errorCount++
    }
  }
}

async function upsertLessons(
  lessons:       BulkLesson[],
  unitYearMap:   Map<string, number>,
  unitOrderMap:  Map<string, Map<string, number>>,
  syncedAt:      Date,
  counts:        BulkSyncCounts,
  prev:          Map<string, string | null>,
): Promise<void> {
  for (const lesson of lessons) {
    try {
      const yearGroup = unitYearMap.get(lesson.unitSlug) ?? null
      const orderMap  = unitOrderMap.get(lesson.unitSlug)
      const orderInUnit = orderMap?.get(lesson.lessonSlug) ?? 0

      // transcript_sentences from bulk API is a raw string; split by newline for
      // backward compat with homework generation (reads as string[]).
      const transcriptLines = lesson.transcript_sentences
        ? lesson.transcript_sentences.split('\n').filter(l => l.trim().length > 0)
        : []

      const existed = prev.has(lesson.lessonSlug)
      const wrote = await writeIfChanged(prev, lesson.lessonSlug, {
          slug:               lesson.lessonSlug,
          title:              lesson.lessonTitle,
          unitSlug:           lesson.unitSlug,
          subjectSlug:        lesson.subjectSlug,
          keystage:           lesson.keyStageSlug,
          yearGroup,
          examBoard:          null,
          tier:               null,
          orderInUnit,
          pupilLessonOutcome: lesson.pupilLessonOutcome ?? null,
          keyLearningPoints:  (lesson.keyLearningPoints  ?? []) as object[],
          lessonKeywords:     (lesson.lessonKeywords      ?? []) as object[],
          lessonOutline:      [],
          starterQuiz:        [],
          exitQuiz:           [],
          misconceptionsAndCommonMistakes: (lesson.misconceptionsAndCommonMistakes ?? []) as object[],
          teacherTips:        (lesson.teacherTips         ?? []) as object[],
          contentGuidance:    (lesson.contentGuidance     ?? []) as object[],
          supervisionLevel:   lesson.supervisionLevel ?? null,
          videoMuxPlaybackId: null,
          videoWithSignLanguageMuxPlaybackId: null,
          transcriptSentences: transcriptLines as unknown as object[],
          worksheetUrl:       null,
          presentationUrl:    null,
          subjectCategories:  [],
          isLegacy:           false,
          expired:            false,
          loginRequired:      false,
          lastSeenAt:         syncedAt,
        }, {
          title:              lesson.lessonTitle,
          unitSlug:           lesson.unitSlug,
          yearGroup,
          orderInUnit,
          pupilLessonOutcome: lesson.pupilLessonOutcome ?? null,
          keyLearningPoints:  (lesson.keyLearningPoints  ?? []) as object[],
          lessonKeywords:     (lesson.lessonKeywords      ?? []) as object[],
          misconceptionsAndCommonMistakes: (lesson.misconceptionsAndCommonMistakes ?? []) as object[],
          teacherTips:        (lesson.teacherTips         ?? []) as object[],
          contentGuidance:    (lesson.contentGuidance     ?? []) as object[],
          supervisionLevel:   lesson.supervisionLevel ?? null,
          transcriptSentences: transcriptLines as unknown as object[],
          expired:            false,
          lastSeenAt:         syncedAt,
          deletedAt:          null,
          // Preserve existing quiz + video data from previous scrape runs
          // (bulk API doesn't include these fields)
        },
        (create, update) => prisma.oakLesson.upsert({ where: { slug: lesson.lessonSlug }, create, update, select: { slug: true } }))
      if (!existed) counts.newLessons++
      else if (wrote) counts.updatedLessons++
    } catch (err) {
      counts.errors.push({ slug: lesson.lessonSlug, message: String(err) })
      counts.errorCount++
    }
  }
}

// ─── Main exported function ───────────────────────────────────────────────────

export async function runBulkSync(): Promise<{ counts: BulkSyncCounts; durationMs: number }> {
  const startTime = Date.now()
  const syncedAt  = new Date()

  const syncLog = await prisma.oakSyncLog.create({
    data: { type: 'bulk', status: 'running' },
  })

  const counts: BulkSyncCounts = {
    subjectPhases:  0,
    newSubjects:    0,
    updatedSubjects: 0,
    newUnits:       0,
    updatedUnits:   0,
    newLessons:     0,
    updatedLessons: 0,
    errorCount:     0,
    errors:         [],
  }

  // What is stored, as slug → hash. Rows marked deleted get no hash, so if
  // Oak still publishes them they are rewritten (and so restored).
  const asPrev = (rows: Array<{ slug: string; syncHash: string | null; deletedAt: Date | null }>) =>
    new Map(rows.map(r => [r.slug, r.deletedAt ? null : r.syncHash]))
  const sel = { select: { slug: true, syncHash: true, deletedAt: true } } as const
  const [prevSubjects, prevUnits, prevLessons] = await Promise.all([
    prisma.oakSubject.findMany(sel).then(asPrev),
    prisma.oakUnit.findMany(sel).then(asPrev),
    prisma.oakLesson.findMany(sel).then(asPrev),
  ])

  try {
    const subjectSlugs = await getSubjectSlugs()
    console.log(`[oak-bulk-sync] ${subjectSlugs.length} subjects found: ${subjectSlugs.join(', ')}`)

    for (const subjectSlug of subjectSlugs) {
      const subjectPhase = `${subjectSlug}-secondary`
      try {
        console.log(`[oak-bulk-sync] Downloading ${subjectPhase}…`)
        const data = await downloadAndParse(subjectPhase)
        if (!data) {
          console.log(`[oak-bulk-sync] ${subjectPhase}: no secondary sequence — skipping`)
          continue
        }

        counts.subjectPhases++
        const title = SUBJECT_TITLES[subjectSlug] ?? data.subjectTitle ?? subjectSlug

        // 1. Subject
        await upsertSubject(subjectSlug, title, syncedAt, counts, prevSubjects)

        // 2. Build lookup maps from the sequence
        //    unitYearMap:  unitSlug → yearGroup
        //    unitOrderMap: unitSlug → Map<lessonSlug, lessonOrder>
        const unitYearMap  = new Map<string, number>()
        const unitOrderMap = new Map<string, Map<string, number>>()
        for (const unit of data.sequence) {
          if (unit.year) unitYearMap.set(unit.unitSlug, unit.year)
          const orderMap = new Map<string, number>()
          for (const ul of unit.unitLessons ?? []) {
            orderMap.set(ul.lessonSlug, ul.lessonOrder)
          }
          unitOrderMap.set(unit.unitSlug, orderMap)
        }

        // 3. Units (must exist before lessons due to FK)
        await upsertUnits(data.sequence, subjectSlug, data.sequenceSlug, syncedAt, counts, prevUnits)

        // 4. Lessons
        await upsertLessons(data.lessons, unitYearMap, unitOrderMap, syncedAt, counts, prevLessons)

        console.log(`[oak-bulk-sync] ${subjectPhase}: ${data.sequence.length} units, ${data.lessons.length} lessons`)
      } catch (err) {
        console.error(`[oak-bulk-sync] ${subjectPhase} FAILED:`, err)
        counts.errors.push({ slug: subjectPhase, message: String(err) })
        counts.errorCount++
      }
    }

    const durationMs = Date.now() - startTime
    const status     = counts.errorCount > 0 ? 'partial' : 'completed'

    await prisma.oakSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status, completedAt: new Date(), durationMs,
        newSubjects:     counts.newSubjects,
        updatedSubjects: counts.updatedSubjects,
        newUnits:        counts.newUnits,
        updatedUnits:    counts.updatedUnits,
        newLessons:      counts.newLessons,
        updatedLessons:  counts.updatedLessons,
        errorCount:      counts.errorCount,
        errors:          counts.errors as object[],
      },
    })

    console.log(`[oak-bulk-sync] Done in ${durationMs}ms — ${counts.newLessons} new, ${counts.updatedLessons} updated lessons across ${counts.subjectPhases} subject phases`)
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
