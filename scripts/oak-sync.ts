/**
 * scripts/oak-sync.ts
 *
 * Fetches all Oak National Academy content and populates the Oak tables.
 *
 * Strategy:
 *   1. Fetch Oak build ID from homepage
 *   2. Parse lesson sitemap → extract (programmeSlug, unitSlug, lessonSlug) triples
 *   3. Fetch units listing per programme → upsert OakSubject + OakUnit
 *   4. Fetch full lesson detail per lesson slug → upsert OakLesson + OakResource
 *
 * Resumable: lessons already in DB are skipped. Re-running is always safe.
 * Run with: npm run oak:sync
 */

import { PrismaClient } from '@prisma/client'

// Use direct URL (port 5432) for long-running scripts to avoid pgbouncer
// transaction-mode connection drops. Falls back to DATABASE_URL if not set.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

// ─── Config ───────────────────────────────────────────────────────────────────

const OAK_BASE = 'https://www.thenational.academy'

const UNIT_CONCURRENCY   = 4
const LESSON_CONCURRENCY = 6

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`)
}

function tick(msg: string) {
  process.stdout.write(msg)
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson(url: string, retries = 3): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Omnis-Oak-Sync/1.0' },
      })
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

// ─── Step 1: Build ID ─────────────────────────────────────────────────────────

async function getBuildId(): Promise<string> {
  log('Fetching Oak build ID…')
  const html = await fetch(OAK_BASE).then(r => r.text())
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (!match) throw new Error('Could not find buildId in Oak homepage HTML')
  log(`  Build ID: ${match[1]}`)
  return match[1]
}

// ─── Step 2: Parse lesson sitemap ─────────────────────────────────────────────

type LessonEntry = {
  programmeSlug: string
  unitSlug:      string
  lessonSlug:    string
}

async function getLessonEntries(): Promise<LessonEntry[]> {
  log('Fetching lesson sitemap…')
  const xml = await fetch(`${OAK_BASE}/teachers/sitemap-1.xml`).then(r => r.text())
  // URLs: /teachers/programmes/{prog}/units/{unit}/lessons/{lesson}
  const pattern = /\/teachers\/programmes\/([^/]+)\/units\/([^/]+)\/lessons\/([^/<]+)/g
  const entries: LessonEntry[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(xml)) !== null) {
    entries.push({ programmeSlug: m[1], unitSlug: m[2], lessonSlug: m[3] })
  }
  const unique = Array.from(
    new Map(entries.map(e => [e.lessonSlug, e])).values()
  )
  log(`  Found ${unique.length} unique lessons across ${new Set(unique.map(e => e.unitSlug)).size} units`)
  return unique
}

// ─── Step 3: Programme metadata ───────────────────────────────────────────────

type ProgrammeMeta = {
  programmeSlug: string
  subjectSlug:   string
  phase:         string
  keystage:      string
  examBoard:     string | null
  tier:          string | null
  isLegacy:      boolean
}

const KS_PHASES: Record<string, string> = {
  ks1: 'primary',
  ks2: 'primary',
  ks3: 'secondary',
  ks4: 'secondary',
  'early-years-foundation-stage': 'primary',
}

const EXAM_BOARDS = new Set(['aqa', 'edexcel', 'edexcelb', 'ocr', 'wjec', 'eduqas', 'pearson'])
const TIERS       = new Set(['foundation', 'higher'])

function parseProgrammeSlug(slug: string): ProgrammeMeta {
  const isLegacy = slug.endsWith('-l')
  const base     = isLegacy ? slug.slice(0, -2) : slug
  const parts    = base.split('-')

  // Key stage: ks1–ks4 or early-years-...
  const ksIdx    = parts.findIndex(p => /^ks[1-4]$/.test(p))
  const keystage = ksIdx >= 0 ? parts[ksIdx] : 'early-years-foundation-stage'
  const phase    = KS_PHASES[keystage] ?? 'primary'

  // Subject = everything before phase keyword
  const phaseIdx    = parts.findIndex(p => p === 'primary' || p === 'secondary' || p === 'foundation')
  const subjectSlug = phaseIdx > 0 ? parts.slice(0, phaseIdx).join('-') : parts[0]

  const after    = ksIdx >= 0 ? parts.slice(ksIdx + 1) : []
  const examBoard = after.find(p => EXAM_BOARDS.has(p)) ?? null
  const tier      = after.find(p => TIERS.has(p)) ?? null

  return { programmeSlug: slug, subjectSlug, phase, keystage, examBoard, tier, isLegacy }
}

// ─── Step 4: Fetch and upsert units for a programme ──────────────────────────

const SUBJECT_TITLES: Record<string, string> = {
  'art':                'Art and design',
  'biology':            'Biology',
  'chemistry':          'Chemistry',
  'citizenship':        'Citizenship',
  'combined-science':   'Combined science',
  'computing':          'Computing',
  'cooking-nutrition':  'Cooking and nutrition',
  'design-technology':  'Design and technology',
  'drama':              'Drama',
  'english':            'English',
  'financial-education':'Financial education',
  'french':             'French',
  'geography':          'Geography',
  'german':             'German',
  'history':            'History',
  'latin':              'Latin',
  'literacy':           'Literacy',
  'maths':              'Maths',
  'music':              'Music',
  'physical-education': 'Physical education',
  'physics':            'Physics',
  'religious-education':'Religious education',
  'rshe-pshe':          'RSHE (PSHE)',
  'science':            'Science',
  'spanish':            'Spanish',
  'expressive-arts-and-design': 'Expressive arts and design',
  'personal-social-and-emotional-development': 'Personal, social and emotional development',
  'understanding-the-world': 'Understanding the world',
}

// A unit object as returned by Oak's units listing
type OakUnitListItem = {
  slug:              string
  title:             string
  nullTitle?:        string
  programmeSlug:     string
  keyStageSlug:      string
  subjectSlug:       string
  year?:             string | number | null
  unitStudyOrder?:   number
  lessonCount?:      number
  subjectCategories?: unknown[]
  learningThemes?:   unknown[]
}

async function syncProgramme(
  buildId:  string,
  meta:     ProgrammeMeta,
  unitSlugsNeeded: Set<string>,
): Promise<number> {
  const url = `${OAK_BASE}/_next/data/${buildId}/teachers/programmes/${meta.programmeSlug}/units.json`
  const data = await fetchJson(url) as { pageProps?: { curriculumData?: { units?: OakUnitListItem[][] } } } | null
  if (!data) return 0

  // units is an array of arrays (optionality groups per study-order slot)
  const nestedUnits = data?.pageProps?.curriculumData?.units ?? []
  const allUnits: OakUnitListItem[] = (nestedUnits as unknown[]).flat() as OakUnitListItem[]

  let saved = 0
  for (const unit of allUnits) {
    if (!unit.slug || !unitSlugsNeeded.has(unit.slug)) continue
    try {
      await prisma.oakUnit.upsert({
        where:  { slug: unit.slug },
        create: {
          slug:            unit.slug,
          title:           unit.title,
          subjectSlug:     meta.subjectSlug,
          keystage:        meta.keystage,
          yearGroup:       unit.year ? parseInt(String(unit.year), 10) : null,
          examBoard:       meta.examBoard,
          tier:            meta.tier,
          programmeSlug:   meta.programmeSlug,
          orderInProgramme: unit.unitStudyOrder ?? 0,
          plannedLessonCount: unit.lessonCount ?? 0,
          isLegacy:        meta.isLegacy,
          subjectCategories: (unit.subjectCategories ?? []) as object[],
          threads:           (unit.learningThemes ?? []) as object[],
        },
        update: {
          title:           unit.title,
          yearGroup:       unit.year ? parseInt(String(unit.year), 10) : null,
          examBoard:       meta.examBoard,
          tier:            meta.tier,
          orderInProgramme: unit.unitStudyOrder ?? 0,
          plannedLessonCount: unit.lessonCount ?? 0,
          subjectCategories: (unit.subjectCategories ?? []) as object[],
          threads:           (unit.learningThemes ?? []) as object[],
        },
      })
      saved++
    } catch {
      // Unit may have been upserted by another programme already — fine
    }
  }
  return saved
}

// ─── Step 5: Fetch and upsert a lesson ───────────────────────────────────────

type OakLessonDetail = {
  lessonSlug:                        string
  lessonTitle:                       string
  unitSlug:                          string
  unitTitle:                         string
  subjectSlug:                       string
  keyStageSlug:                      string
  year?:                             string | number | null
  examBoardSlug?:                    string | null
  tierSlug?:                         string | null
  orderInUnit?:                      number
  pupilLessonOutcome?:               string | null
  keyLearningPoints?:                unknown[]
  lessonKeywords?:                   unknown[]
  lessonOutline?:                    unknown[]
  starterQuiz?:                      unknown[]
  exitQuiz?:                         unknown[]
  misconceptionsAndCommonMistakes?:  unknown[]
  teacherTips?:                      unknown[]
  contentGuidance?:                  unknown[]
  supervisionLevel?:                 string | null
  videoMuxPlaybackId?:               string | null
  videoWithSignLanguageMuxPlaybackId?: string | null
  transcriptSentences?:              string[]
  worksheetUrl?:                     string | null
  presentationUrl?:                  string | null
  subjectCategories?:                unknown[]
  isLegacy?:                         boolean
  expired?:                          boolean
  loginRequired?:                    boolean
  downloads?:                        { type: string; label?: string; ext?: string; exists: boolean }[]
}

async function syncLesson(buildId: string, entry: LessonEntry): Promise<boolean> {
  const url = `${OAK_BASE}/_next/data/${buildId}/teachers/lessons/${entry.lessonSlug}.json`
  const data = await fetchJson(url) as { pageProps?: { lesson?: OakLessonDetail } } | null
  if (!data) return false

  const lesson = data?.pageProps?.lesson
  if (!lesson?.lessonSlug) return false

  const yearGroup = lesson.year ? parseInt(String(lesson.year), 10) : null

  await prisma.oakLesson.upsert({
    where:  { slug: lesson.lessonSlug },
    create: {
      slug:        lesson.lessonSlug,
      title:       lesson.lessonTitle,
      unitSlug:    entry.unitSlug,
      subjectSlug: lesson.subjectSlug,
      keystage:    lesson.keyStageSlug,
      yearGroup,
      examBoard:   lesson.examBoardSlug ?? null,
      tier:        lesson.tierSlug ?? null,
      orderInUnit: lesson.orderInUnit ?? 0,

      pupilLessonOutcome: lesson.pupilLessonOutcome ?? null,
      keyLearningPoints:  (lesson.keyLearningPoints ?? []) as object[],
      lessonKeywords:     (lesson.lessonKeywords ?? []) as object[],
      lessonOutline:      (lesson.lessonOutline ?? []) as object[],
      starterQuiz:        (lesson.starterQuiz ?? []) as object[],
      exitQuiz:           (lesson.exitQuiz ?? []) as object[],

      misconceptionsAndCommonMistakes: (lesson.misconceptionsAndCommonMistakes ?? []) as object[],
      teacherTips:                     (lesson.teacherTips ?? []) as object[],
      contentGuidance:                 (lesson.contentGuidance ?? []) as object[],
      supervisionLevel:                lesson.supervisionLevel ?? null,

      videoMuxPlaybackId:                 lesson.videoMuxPlaybackId ?? null,
      videoWithSignLanguageMuxPlaybackId: lesson.videoWithSignLanguageMuxPlaybackId ?? null,
      transcriptSentences:                (lesson.transcriptSentences ?? []) as string[],

      worksheetUrl:      lesson.worksheetUrl ?? null,
      presentationUrl:   lesson.presentationUrl ?? null,
      subjectCategories: (lesson.subjectCategories ?? []) as object[],

      isLegacy:      lesson.isLegacy ?? false,
      expired:       lesson.expired ?? false,
      loginRequired: lesson.loginRequired ?? false,
    },
    update: {
      title:       lesson.lessonTitle,
      unitSlug:    entry.unitSlug,
      yearGroup,
      examBoard:   lesson.examBoardSlug ?? null,
      tier:        lesson.tierSlug ?? null,
      orderInUnit: lesson.orderInUnit ?? 0,

      pupilLessonOutcome: lesson.pupilLessonOutcome ?? null,
      keyLearningPoints:  (lesson.keyLearningPoints ?? []) as object[],
      lessonKeywords:     (lesson.lessonKeywords ?? []) as object[],
      lessonOutline:      (lesson.lessonOutline ?? []) as object[],
      starterQuiz:        (lesson.starterQuiz ?? []) as object[],
      exitQuiz:           (lesson.exitQuiz ?? []) as object[],

      misconceptionsAndCommonMistakes: (lesson.misconceptionsAndCommonMistakes ?? []) as object[],
      teacherTips:                     (lesson.teacherTips ?? []) as object[],
      contentGuidance:                 (lesson.contentGuidance ?? []) as object[],
      supervisionLevel:                lesson.supervisionLevel ?? null,

      videoMuxPlaybackId:                 lesson.videoMuxPlaybackId ?? null,
      videoWithSignLanguageMuxPlaybackId: lesson.videoWithSignLanguageMuxPlaybackId ?? null,
      transcriptSentences:                (lesson.transcriptSentences ?? []) as string[],

      worksheetUrl:      lesson.worksheetUrl ?? null,
      presentationUrl:   lesson.presentationUrl ?? null,
      subjectCategories: (lesson.subjectCategories ?? []) as object[],

      expired:       lesson.expired ?? false,
      loginRequired: lesson.loginRequired ?? false,
    },
  })

  // Upsert resources
  for (const dl of lesson.downloads ?? []) {
    await prisma.oakResource.upsert({
      where:  { lessonSlug_type: { lessonSlug: lesson.lessonSlug, type: dl.type } },
      create: {
        type:   dl.type,
        label:  dl.label ?? null,
        ext:    dl.ext ?? null,
        exists: dl.exists ?? true,
        lesson: { connect: { slug: lesson.lessonSlug } },
      },
      update: { label: dl.label ?? null, ext: dl.ext ?? null, exists: dl.exists ?? true },
    })
  }

  return true
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('═══════════════════════════════════════════')
  log('  Oak National Academy — Content Sync')
  log('═══════════════════════════════════════════')

  const startTime = Date.now()
  let errors = 0

  // 1. Build ID
  const buildId = await getBuildId()

  // 2. All lesson entries from sitemap
  const lessonEntries = await getLessonEntries()

  // Derive all unique programmes and units from entries
  const programmeMap = new Map<string, ProgrammeMeta>()
  const unitSlugsNeeded = new Set<string>()
  for (const e of lessonEntries) {
    if (!programmeMap.has(e.programmeSlug)) {
      programmeMap.set(e.programmeSlug, parseProgrammeSlug(e.programmeSlug))
    }
    unitSlugsNeeded.add(e.unitSlug)
  }
  const programmes = Array.from(programmeMap.values())
  log(`  ${programmes.length} programmes, ${unitSlugsNeeded.size} unique units`)

  // 3. Upsert subjects
  log(`\nStep 1/3 — Syncing subjects…`)
  const uniqueSubjects = Array.from(new Map(programmes.map(p => [p.subjectSlug, p])).values())
  for (const meta of uniqueSubjects) {
    await prisma.oakSubject.upsert({
      where:  { slug: meta.subjectSlug },
      create: { slug: meta.subjectSlug, title: SUBJECT_TITLES[meta.subjectSlug] ?? meta.subjectSlug, phase: meta.phase },
      update: { phase: meta.phase },
    })
  }
  log(`  ✓ ${uniqueSubjects.length} subjects`)

  // 4. Fetch units per programme and upsert
  log(`\nStep 2/3 — Syncing units from ${programmes.length} programmes…`)
  let unitsDone = 0
  let progDone  = 0

  await withConcurrency(programmes, UNIT_CONCURRENCY, async (meta) => {
    try {
      const saved = await syncProgramme(buildId, meta, unitSlugsNeeded)
      unitsDone += saved
    } catch (err) {
      log(`  ✗ Programme ${meta.programmeSlug}: ${err}`)
      errors++
    }
    progDone++
    if (progDone % 20 === 0 || progDone === programmes.length) {
      log(`  [${progDone}/${programmes.length}] programmes processed, ${unitsDone} units saved`)
    }
  })
  log(`  ✓ ${unitsDone} units synced`)

  // 5. Fetch lessons — skip those already in DB
  log(`\nStep 3/3 — Syncing ${lessonEntries.length} lessons…`)

  // Skip lessons that are fully synced (exist in DB AND have at least 1 resource).
  // Lessons with 0 resources may have had a failed resource upsert — re-sync them.
  const lessonsInDb = await prisma.oakLesson.findMany({
    select: { slug: true, resources: { select: { id: true }, take: 1 } },
  })
  const fullySynced = new Set(
    lessonsInDb.filter(l => l.resources.length > 0).map(l => l.slug)
  )
  const toFetch = lessonEntries.filter(e => !fullySynced.has(e.lessonSlug))
  const skipped = lessonEntries.length - toFetch.length
  log(`  ${skipped} fully synced — fetching/repairing ${toFetch.length}`)

  let lessonsDone = 0
  let lessonIdx   = 0

  await withConcurrency(toFetch, LESSON_CONCURRENCY, async (entry) => {
    const i = lessonIdx++
    try {
      const ok = await syncLesson(buildId, entry)
      if (ok) lessonsDone++
    } catch (err) {
      log(`  ✗ Lesson ${entry.lessonSlug}: ${err}`)
      errors++
    }
    if ((i + 1) % 200 === 0 || i + 1 === toFetch.length) {
      tick(`  [${i + 1}/${toFetch.length}] ${lessonsDone} saved, ${errors} errors\n`)
    }
  })

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  log('\n═══════════════════════════════════════════')
  log('  Sync complete')
  log(`  Subjects:  ${uniqueSubjects.length}`)
  log(`  Units:     ${unitsDone}`)
  log(`  Lessons:   ${lessonsDone} new  |  ${skipped} already present`)
  log(`  Errors:    ${errors}`)
  log(`  Time:      ${elapsed}s`)
  log('═══════════════════════════════════════════')
}

main()
  .catch(err => { log(`\nFATAL: ${err}`); process.exit(1) })
  .finally(() => prisma.$disconnect())
