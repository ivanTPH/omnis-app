/**
 * lib/oak-content.ts
 *
 * Shared Oak curriculum data helper used by all agents and generation functions.
 *
 * Provides module-level in-process caching (max 500 entries, 24 h TTL) so that
 * repeated lookups within the same Lambda invocation — or across close cron
 * invocations when the container is warm — avoid redundant DB round-trips.
 *
 * Public API:
 *   getOakLessonContent(slug)          → full content for one Oak lesson
 *   getOakDataForLesson(lessonId)      → Oak content via lesson → resource join
 *   findOakDataForTopics(topics, subj) → Oak lessons relevant to a set of topic strings
 *   extractMisconceptions(lessons)     → flat list of misconception strings
 *   extractKeywords(lessons)           → flat list of "word: definition" strings
 */

import { prisma } from '@/lib/prisma'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OakLessonContent = {
  slug:                           string
  title:                          string
  subjectSlug:                    string
  keystage:                       string | null
  pupilLessonOutcome:             string | null
  keyLearningPoints:              unknown[]
  lessonKeywords:                 unknown[]
  misconceptionsAndCommonMistakes: unknown[]
  transcriptSentences:            unknown[]
  teacherTips:                    unknown[]
}

// ── In-process cache ──────────────────────────────────────────────────────────

const MAX_CACHE_SIZE = 500
const TTL_MS         = 24 * 60 * 60 * 1_000  // 24 h

type CacheEntry = { data: OakLessonContent; expiresAt: number }
const bySlug      = new Map<string, CacheEntry>()   // slug → content
const byLessonId  = new Map<string, string | null>() // lessonId → slug | null

function get(slug: string): OakLessonContent | null {
  const entry = bySlug.get(slug)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { bySlug.delete(slug); return null }
  return entry.data
}

function set(data: OakLessonContent): void {
  if (bySlug.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry (first inserted)
    const first = bySlug.keys().next().value
    if (first) bySlug.delete(first)
  }
  bySlug.set(data.slug, { data, expiresAt: Date.now() + TTL_MS })
}

// ── DB select shape ───────────────────────────────────────────────────────────

const SELECT = {
  slug: true, title: true, subjectSlug: true, keystage: true,
  pupilLessonOutcome: true, keyLearningPoints: true, lessonKeywords: true,
  misconceptionsAndCommonMistakes: true, transcriptSentences: true, teacherTips: true,
} as const

// ── Public helpers ────────────────────────────────────────────────────────────

/** Returns full Oak content for a single lesson slug, with caching. */
export async function getOakLessonContent(slug: string): Promise<OakLessonContent | null> {
  const cached = get(slug)
  if (cached) return cached

  const row = await prisma.oakLesson.findUnique({ where: { slug }, select: SELECT })
  if (!row) return null

  const data = row as OakLessonContent
  set(data)
  return data
}

/**
 * Returns the first Oak lesson associated with a Lesson (via its resources).
 * Results are cached by lessonId so warm containers skip the join.
 */
export async function getOakDataForLesson(lessonId: string): Promise<OakLessonContent | null> {
  // Cached miss
  if (byLessonId.has(lessonId)) {
    const slug = byLessonId.get(lessonId)
    return slug ? get(slug) ?? await getOakLessonContent(slug) : null
  }

  // Join: Resource with oakContentId for this lesson
  const resource = await prisma.resource.findFirst({
    where:  { lessonId, oakContentId: { not: null } },
    select: { oakContentId: true },
  })
  const slug = resource?.oakContentId ?? null
  byLessonId.set(lessonId, slug)
  if (!slug) return null
  return getOakLessonContent(slug)
}

/**
 * Finds Oak lessons relevant to a set of topic/objective strings for a subject.
 * Uses title + outcome full-text matching. Returns up to `limit` lessons.
 */
export async function findOakDataForTopics(
  topics:     string[],
  subjectSlug: string,
  limit = 4,
): Promise<OakLessonContent[]> {
  if (topics.length === 0) return []

  // Build OR clauses — search title and pupilLessonOutcome per topic
  const terms = topics.flatMap(t => t.split(/\s+/).filter(w => w.length > 3))
  if (terms.length === 0) return []

  const rows = await prisma.oakLesson.findMany({
    where: {
      subjectSlug,
      OR: terms.map(term => ({
        OR: [
          { title:              { contains: term, mode: 'insensitive' } },
          { pupilLessonOutcome: { contains: term, mode: 'insensitive' } },
        ],
      })),
    },
    select: SELECT,
    take:   limit,
  })

  const results = rows as OakLessonContent[]
  results.forEach(r => set(r))
  return results
}

// ── Extraction helpers used by agents ─────────────────────────────────────────

/** Returns a flat list of misconception strings from an array of OakLesson rows. */
export function extractMisconceptions(lessons: OakLessonContent[]): string[] {
  return lessons.flatMap(l => {
    const arr = Array.isArray(l.misconceptionsAndCommonMistakes)
      ? l.misconceptionsAndCommonMistakes as unknown[]
      : []
    return arr.map(m => {
      if (typeof m === 'string') return m
      const obj = m as Record<string, unknown>
      const mc  = (obj.misconception ?? '') as string
      const res = (obj.response ?? '') as string
      return mc ? (res ? `${mc} (response: ${res})` : mc) : ''
    }).filter(Boolean)
  })
}

/** Returns a flat list of "keyword: definition" strings. */
export function extractKeywords(lessons: OakLessonContent[]): string[] {
  return lessons.flatMap(l => {
    const arr = Array.isArray(l.lessonKeywords) ? l.lessonKeywords as unknown[] : []
    return arr.map(k => {
      if (typeof k === 'string') return k
      const obj  = k as Record<string, unknown>
      const word = (obj.keyword ?? '') as string
      const def  = (obj.description ?? '') as string
      return word ? (def ? `${word}: ${def}` : word) : ''
    }).filter(Boolean)
  })
}

/** Returns a flat list of key learning point strings. */
export function extractKlps(lessons: OakLessonContent[]): string[] {
  return lessons.flatMap(l => {
    const arr = Array.isArray(l.keyLearningPoints) ? l.keyLearningPoints as unknown[] : []
    return arr.map(p => {
      if (typeof p === 'string') return p
      return ((p as Record<string, unknown>).keyLearningPoint ?? '') as string
    }).filter(Boolean)
  })
}
