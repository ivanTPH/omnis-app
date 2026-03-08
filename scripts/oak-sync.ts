/**
 * scripts/oak-sync.ts
 *
 * Fetches all Oak National Academy content and populates the Oak tables.
 *
 * Strategy:
 *   1. Fetch the Oak build ID from the homepage (needed for _next/data URLs)
 *   2. Fetch all programme slugs from the sitemap (all 159 programmes)
 *   3. For each programme → fetch all units
 *   4. For each unit → fetch all lesson slugs
 *   5. For each lesson slug → fetch full lesson detail
 *   6. Upsert everything into OakSubject / OakUnit / OakLesson / OakResource
 *
 * Resumable: records already in the DB are skipped (upsert on slug PK).
 * Run with: npm run oak:sync
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Config ──────────────────────────────────────────────────────────────────

const OAK_BASE   = 'https://www.thenational.academy'
const SEARCH_API = 'https://api.thenational.academy/api/search'

// Concurrency limits to avoid hammering Oak's CDN
const UNIT_CONCURRENCY   = 3
const LESSON_CONCURRENCY = 5

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`)
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
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return await res.json()
    } catch (err) {
      if (attempt === retries) throw err
      const delay = attempt * 1000
      log(`  ⚠ Retry ${attempt}/${retries - 1} for ${url.slice(0, 80)} (${delay}ms)`)
      await sleep(delay)
    }
  }
  throw new Error('fetchJson: exhausted retries')
}

/** Run an array of tasks with bounded concurrency */
async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx  = i++
      await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
}

// ─── Step 1: Get Oak build ID ─────────────────────────────────────────────────

async function getBuildId(): Promise<string> {
  log('Fetching Oak build ID…')
  const html = await fetch(OAK_BASE).then(r => r.text())
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/)
  if (!match) throw new Error('Could not find buildId in Oak homepage HTML')
  log(`  Build ID: ${match[1]}`)
  return match[1]
}

// ─── Step 2: Discover all programme slugs from sitemap ───────────────────────

async function getProgrammeSlugs(): Promise<string[]> {
  log('Fetching programme sitemap…')
  const xml = await fetch(`${OAK_BASE}/teachers/sitemap.xml`).then(r => r.text())
  // Extract /teachers/programmes/{slug}/units URLs
  const matches = Array.from(xml.matchAll(/\/teachers\/programmes\/([^/]+)\/units/g))
  const slugs = Array.from(new Set(matches.map(m => m[1])))
  log(`  Found ${slugs.length} programme slugs`)
  return slugs
}

// ─── Step 3: Parse a programme slug into metadata ─────────────────────────────

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
}

const EXAM_BOARDS = new Set(['aqa', 'edexcel', 'edexcelb', 'ocr', 'wjec', 'eduqas', 'pearson'])
const TIERS       = new Set(['foundation', 'higher'])

function parseProgrammeSlug(slug: string): ProgrammeMeta {
  // Remove trailing -l (legacy) suffix
  const isLegacy  = slug.endsWith('-l')
  const base      = isLegacy ? slug.slice(0, -2) : slug
  const parts     = base.split('-')

  // Find the keystage part (ks1|ks2|ks3|ks4)
  const ksIdx     = parts.findIndex(p => /^ks[1-4]$/.test(p))
  const keystage  = parts[ksIdx] ?? 'ks3'
  const phase     = KS_PHASES[keystage] ?? 'secondary'

  // Subject is everything before the phase word (primary|secondary)
  const phaseIdx  = parts.findIndex(p => p === 'primary' || p === 'secondary')
  const subjectSlug = parts.slice(0, phaseIdx).join('-')

  // Everything after the keystage part
  const after     = parts.slice(ksIdx + 1)
  const examBoard = after.find(p => EXAM_BOARDS.has(p)) ?? null
  const tier      = after.find(p => TIERS.has(p)) ?? null

  return { programmeSlug: slug, subjectSlug, phase, keystage, examBoard, tier, isLegacy }
}

// ─── Step 4: Fetch units for a programme ─────────────────────────────────────

type OakUnitRaw = {
  unitSlug:                   string
  unitTitle:                  string
  year?:                      number | null
  description?:               string | null
  whyThisWhyNow?:             string | null
  connectionPriorUnitTitle?:  string | null
  connectionFutureUnitTitle?: string | null
  plannedNumberOfLessons?:    number
  order?:                     number
  threads?:                   unknown[]
  subjectcategories?:         unknown[]
  nationalCurriculumContent?: unknown[]
  priorKnowledgeRequirements?: string[]
  lessons?:                   { lessonSlug: string; lessonTitle: string }[]
  unitStudyOrder?:            number
}

async function fetchUnits(buildId: string, meta: ProgrammeMeta): Promise<OakUnitRaw[]> {
  const url = `${OAK_BASE}/_next/data/${buildId}/teachers/programmes/${meta.programmeSlug}/units.json`
  try {
    const data = await fetchJson(url) as { pageProps?: { curriculumData?: { units?: OakUnitRaw[] } } }
    return data?.pageProps?.curriculumData?.units ?? []
  } catch {
    return []
  }
}

// ─── Step 5: Fetch full lesson detail ────────────────────────────────────────

type OakLessonRaw = {
  lessonSlug:                        string
  lessonTitle:                       string
  unitSlug:                          string
  subjectSlug:                       string
  keyStageSlug:                      string
  year?:                             number | null
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

async function fetchLesson(buildId: string, lessonSlug: string): Promise<OakLessonRaw | null> {
  const url = `${OAK_BASE}/_next/data/${buildId}/teachers/lessons/${lessonSlug}.json`
  try {
    const data = await fetchJson(url) as { pageProps?: { curriculumData?: { lesson?: OakLessonRaw } } }
    return data?.pageProps?.curriculumData?.lesson ?? null
  } catch {
    return null
  }
}

// ─── Step 6: Upsert helpers ───────────────────────────────────────────────────

const SUBJECT_TITLES: Record<string, string> = {
  'art':                   'Art and design',
  'biology':               'Biology',
  'chemistry':             'Chemistry',
  'citizenship':           'Citizenship',
  'combined-science':      'Combined science',
  'computing':             'Computing',
  'computing-non-gcse':    'Computing (non-GCSE)',
  'cooking-nutrition':     'Cooking and nutrition',
  'design-technology':     'Design and technology',
  'drama':                 'Drama',
  'english':               'English',
  'financial-education':   'Financial education',
  'french':                'French',
  'geography':             'Geography',
  'german':                'German',
  'history':               'History',
  'latin':                 'Latin',
  'maths':                 'Maths',
  'music':                 'Music',
  'physical-education':    'Physical education',
  'physics':               'Physics',
  'religious-education':   'Religious education',
  'rshe-pshe':             'RSHE (PSHE)',
  'science':               'Science',
  'spanish':               'Spanish',
}

async function upsertSubject(meta: ProgrammeMeta) {
  await prisma.oakSubject.upsert({
    where:  { slug: meta.subjectSlug },
    create: {
      slug:  meta.subjectSlug,
      title: SUBJECT_TITLES[meta.subjectSlug] ?? meta.subjectSlug,
      phase: meta.phase,
    },
    update: { phase: meta.phase },
  })
}

async function upsertUnit(meta: ProgrammeMeta, raw: OakUnitRaw) {
  await prisma.oakUnit.upsert({
    where:  { slug: raw.unitSlug },
    create: {
      slug:          raw.unitSlug,
      title:         raw.unitTitle,
      subjectSlug:   meta.subjectSlug,
      keystage:      meta.keystage,
      yearGroup:     raw.year ?? null,
      examBoard:     meta.examBoard,
      tier:          meta.tier,
      programmeSlug: meta.programmeSlug,
      description:   raw.description ?? null,
      whyThisWhyNow: raw.whyThisWhyNow ?? null,
      connectionPriorUnit:  raw.connectionPriorUnitTitle ?? null,
      connectionFutureUnit: raw.connectionFutureUnitTitle ?? null,
      plannedLessonCount:   raw.plannedNumberOfLessons ?? 0,
      orderInProgramme:     raw.order ?? raw.unitStudyOrder ?? 0,
      isLegacy:             meta.isLegacy,
      threads:                    (raw.threads ?? []) as object[],
      subjectCategories:          (raw.subjectcategories ?? []) as object[],
      nationalCurriculumContent:  (raw.nationalCurriculumContent ?? []) as object[],
      priorKnowledgeRequirements: (raw.priorKnowledgeRequirements ?? []) as string[],
    },
    update: {
      title:         raw.unitTitle,
      yearGroup:     raw.year ?? null,
      examBoard:     meta.examBoard,
      tier:          meta.tier,
      description:   raw.description ?? null,
      whyThisWhyNow: raw.whyThisWhyNow ?? null,
      connectionPriorUnit:  raw.connectionPriorUnitTitle ?? null,
      connectionFutureUnit: raw.connectionFutureUnitTitle ?? null,
      plannedLessonCount:   raw.plannedNumberOfLessons ?? 0,
      threads:                    (raw.threads ?? []) as object[],
      subjectCategories:          (raw.subjectcategories ?? []) as object[],
      nationalCurriculumContent:  (raw.nationalCurriculumContent ?? []) as object[],
      priorKnowledgeRequirements: (raw.priorKnowledgeRequirements ?? []) as string[],
    },
  })
}

async function upsertLesson(raw: OakLessonRaw) {
  await prisma.oakLesson.upsert({
    where:  { slug: raw.lessonSlug },
    create: {
      slug:        raw.lessonSlug,
      title:       raw.lessonTitle,
      unitSlug:    raw.unitSlug,
      subjectSlug: raw.subjectSlug,
      keystage:    raw.keyStageSlug,
      yearGroup:   raw.year ?? null,
      examBoard:   raw.examBoardSlug ?? null,
      tier:        raw.tierSlug ?? null,
      orderInUnit: raw.orderInUnit ?? 0,

      pupilLessonOutcome: raw.pupilLessonOutcome ?? null,
      keyLearningPoints:  (raw.keyLearningPoints ?? []) as object[],
      lessonKeywords:     (raw.lessonKeywords ?? []) as object[],
      lessonOutline:      (raw.lessonOutline ?? []) as object[],
      starterQuiz:        (raw.starterQuiz ?? []) as object[],
      exitQuiz:           (raw.exitQuiz ?? []) as object[],

      misconceptionsAndCommonMistakes: (raw.misconceptionsAndCommonMistakes ?? []) as object[],
      teacherTips:                     (raw.teacherTips ?? []) as object[],
      contentGuidance:                 (raw.contentGuidance ?? []) as object[],
      supervisionLevel:                raw.supervisionLevel ?? null,

      videoMuxPlaybackId:                 raw.videoMuxPlaybackId ?? null,
      videoWithSignLanguageMuxPlaybackId: raw.videoWithSignLanguageMuxPlaybackId ?? null,
      transcriptSentences:                (raw.transcriptSentences ?? []) as string[],

      worksheetUrl:    raw.worksheetUrl ?? null,
      presentationUrl: raw.presentationUrl ?? null,
      subjectCategories: (raw.subjectCategories ?? []) as object[],

      isLegacy:      raw.isLegacy ?? false,
      expired:       raw.expired ?? false,
      loginRequired: raw.loginRequired ?? false,
    },
    update: {
      title:       raw.lessonTitle,
      unitSlug:    raw.unitSlug,
      yearGroup:   raw.year ?? null,
      examBoard:   raw.examBoardSlug ?? null,
      tier:        raw.tierSlug ?? null,
      orderInUnit: raw.orderInUnit ?? 0,

      pupilLessonOutcome: raw.pupilLessonOutcome ?? null,
      keyLearningPoints:  (raw.keyLearningPoints ?? []) as object[],
      lessonKeywords:     (raw.lessonKeywords ?? []) as object[],
      lessonOutline:      (raw.lessonOutline ?? []) as object[],
      starterQuiz:        (raw.starterQuiz ?? []) as object[],
      exitQuiz:           (raw.exitQuiz ?? []) as object[],

      misconceptionsAndCommonMistakes: (raw.misconceptionsAndCommonMistakes ?? []) as object[],
      teacherTips:                     (raw.teacherTips ?? []) as object[],
      contentGuidance:                 (raw.contentGuidance ?? []) as object[],
      supervisionLevel:                raw.supervisionLevel ?? null,

      videoMuxPlaybackId:                 raw.videoMuxPlaybackId ?? null,
      videoWithSignLanguageMuxPlaybackId: raw.videoWithSignLanguageMuxPlaybackId ?? null,
      transcriptSentences:                (raw.transcriptSentences ?? []) as string[],

      worksheetUrl:    raw.worksheetUrl ?? null,
      presentationUrl: raw.presentationUrl ?? null,
      subjectCategories: (raw.subjectCategories ?? []) as object[],

      expired:       raw.expired ?? false,
      loginRequired: raw.loginRequired ?? false,
    },
  })

  // Upsert resources (downloads)
  if (raw.downloads && raw.downloads.length > 0) {
    for (const dl of raw.downloads) {
      await prisma.oakResource.upsert({
        where:  { lessonSlug_type: { lessonSlug: raw.lessonSlug, type: dl.type } },
        create: {
          lessonSlug: raw.lessonSlug,
          type:       dl.type,
          label:      dl.label ?? null,
          ext:        dl.ext ?? null,
          exists:     dl.exists,
        },
        update: {
          label:  dl.label ?? null,
          ext:    dl.ext ?? null,
          exists: dl.exists,
        },
      })
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('═══════════════════════════════════════════')
  log('  Oak National Academy — Content Sync')
  log('═══════════════════════════════════════════')

  const startTime = Date.now()

  // 1. Get build ID
  const buildId = await getBuildId()

  // 2. Get all programme slugs
  const programmeSlugs = await getProgrammeSlugs()

  // 3. Parse into metadata
  const programmes = programmeSlugs.map(parseProgrammeSlug)
  log(`Parsed ${programmes.length} programmes across ${new Set(programmes.map(p => p.subjectSlug)).size} subjects`)

  // Counters
  let subjectsDone = 0
  let unitsDone    = 0
  let lessonsDone  = 0
  let lessonsSkipped = 0
  let errors       = 0

  // 4. Upsert subjects first
  const uniqueSubjects = Array.from(new Map(programmes.map(p => [p.subjectSlug, p])).values())
  log(`\nStep 1/3 — Syncing ${uniqueSubjects.length} subjects…`)
  for (const meta of uniqueSubjects) {
    await upsertSubject(meta)
    subjectsDone++
  }
  log(`  ✓ ${subjectsDone} subjects synced`)

  // 5. Fetch and upsert units for each programme
  log(`\nStep 2/3 — Fetching units for ${programmes.length} programmes…`)

  // Collect all (unit, lessons[]) pairs — deduplicated by unitSlug
  const unitMap = new Map<string, { meta: ProgrammeMeta; raw: OakUnitRaw }>()

  await withConcurrency(programmes, UNIT_CONCURRENCY, async (meta, i) => {
    const units = await fetchUnits(buildId, meta)
    for (const unit of units) {
      if (!unitMap.has(unit.unitSlug)) {
        unitMap.set(unit.unitSlug, { meta, raw: unit })
      }
    }
    process.stdout.write(`  [${i + 1}/${programmes.length}] ${meta.programmeSlug} → ${units.length} units\n`)
  })

  // Upsert deduplicated units
  for (const { meta, raw } of Array.from(unitMap.values())) {
    try {
      await upsertUnit(meta, raw)
      unitsDone++
    } catch (err) {
      log(`  ✗ Unit ${raw.unitSlug}: ${err}`)
      errors++
    }
  }
  log(`  ✓ ${unitsDone} units synced (${unitMap.size} unique across all programmes)`)

  // 6. Collect all lesson slugs from units
  log(`\nStep 3/3 — Fetching lesson details…`)
  const allLessonSlugs: string[] = []
  for (const { raw } of Array.from(unitMap.values())) {
    for (const lesson of raw.lessons ?? []) {
      allLessonSlugs.push(lesson.lessonSlug)
    }
  }
  const uniqueLessonSlugs = Array.from(new Set(allLessonSlugs))
  log(`  ${uniqueLessonSlugs.length} unique lesson slugs to sync`)

  // Check which are already in the DB (resumability)
  const existingLessons = await prisma.oakLesson.findMany({
    select: { slug: true },
  })
  const existingSlugs = new Set(existingLessons.map(l => l.slug))
  const toFetch = uniqueLessonSlugs.filter(s => !existingSlugs.has(s))
  lessonsSkipped = uniqueLessonSlugs.length - toFetch.length

  log(`  ${lessonsSkipped} already in DB (skipped) — fetching ${toFetch.length} new lessons`)

  await withConcurrency(toFetch, LESSON_CONCURRENCY, async (slug, i) => {
    try {
      const lesson = await fetchLesson(buildId, slug)
      if (!lesson) {
        log(`  ⚠ No data for lesson: ${slug}`)
        return
      }
      await upsertLesson(lesson)
      lessonsDone++
      if ((i + 1) % 50 === 0 || i + 1 === toFetch.length) {
        log(`  [${i + 1}/${toFetch.length}] lessons fetched (${lessonsDone} saved, ${errors} errors)`)
      }
    } catch (err) {
      log(`  ✗ Lesson ${slug}: ${err}`)
      errors++
    }
  })

  // ─── Summary ────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  log('\n═══════════════════════════════════════════')
  log('  Sync complete')
  log(`  Subjects:  ${subjectsDone}`)
  log(`  Units:     ${unitsDone}`)
  log(`  Lessons:   ${lessonsDone} new, ${lessonsSkipped} already present`)
  log(`  Errors:    ${errors}`)
  log(`  Time:      ${elapsed}s`)
  log('═══════════════════════════════════════════')
}

main()
  .catch(err => {
    log(`\nFATAL: ${err}`)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
