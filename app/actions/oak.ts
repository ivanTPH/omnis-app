'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { ResourceType } from '@prisma/client'

// ── Subjects ──────────────────────────────────────────────────────────────────

export async function getOakSubjects() {
  return prisma.oakSubject.findMany({
    where:   { deletedAt: null },
    orderBy: { title: 'asc' },
  })
}

// ── Search ────────────────────────────────────────────────────────────────────

export type OakLessonSearchResult = {
  slug:               string
  title:              string
  unitSlug:           string
  unitTitle:          string
  subjectSlug:        string
  keystage:           string
  yearGroup:          number | null
  examBoard:          string | null
  tier:               string | null
  pupilLessonOutcome: string | null
  hasQuiz:            boolean
  hasVideo:           boolean
  hasWorksheet:       boolean
  hasSlides:          boolean
}

export async function searchOakLessons(params: {
  subjectSlug?: string
  yearGroup?:   number
  keystage?:    string
  examBoard?:   string
  query?:       string
  limit?:       number
}): Promise<OakLessonSearchResult[]> {
  const { subjectSlug, yearGroup, keystage, examBoard, query, limit = 50 } = params

  const rows = await prisma.oakLesson.findMany({
    where: {
      isLegacy:  false,
      expired:   false,
      deletedAt: null,
      ...(subjectSlug ? { subjectSlug } : {}),
      // When searching by keyword, skip yearGroup so results span all year groups
      ...(!query && yearGroup ? { yearGroup } : {}),
      ...(keystage  ? { keystage }  : {}),
      ...(examBoard ? { examBoard } : {}),
      ...(query ? {
        OR: [
          { title:              { contains: query, mode: 'insensitive' } },
          { pupilLessonOutcome: { contains: query, mode: 'insensitive' } },
          { unitSlug:           { contains: query.toLowerCase().replace(/\s+/g, '-') } },
        ],
      } : {}),
    },
    select: {
      slug:               true,
      title:              true,
      unitSlug:           true,
      subjectSlug:        true,
      keystage:           true,
      yearGroup:          true,
      examBoard:          true,
      tier:               true,
      pupilLessonOutcome: true,
      starterQuiz:        true,
      exitQuiz:           true,
      videoMuxPlaybackId: true,
      worksheetUrl:       true,
      presentationUrl:    true,
      unit: { select: { title: true } },
    },
    orderBy: [{ yearGroup: 'asc' }, { orderInUnit: 'asc' }],
    take: limit,
  })

  return rows.map(l => ({
    slug:               l.slug,
    title:              l.title,
    unitSlug:           l.unitSlug,
    unitTitle:          l.unit.title,
    subjectSlug:        l.subjectSlug,
    keystage:           l.keystage,
    yearGroup:          l.yearGroup,
    examBoard:          l.examBoard,
    tier:               l.tier,
    pupilLessonOutcome: l.pupilLessonOutcome,
    hasQuiz:      (Array.isArray(l.starterQuiz) && (l.starterQuiz as unknown[]).length > 0)
               || (Array.isArray(l.exitQuiz)    && (l.exitQuiz    as unknown[]).length > 0),
    hasVideo:     !!l.videoMuxPlaybackId,
    hasWorksheet: !!l.worksheetUrl,
    hasSlides:    !!l.presentationUrl,
  }))
}

// ── Full lesson detail ────────────────────────────────────────────────────────

export async function getOakLesson(slug: string) {
  return prisma.oakLesson.findFirst({
    where:   { slug, deletedAt: null },
    include: { unit: { select: { title: true } } },
  })
}

// ── Add Oak lesson as a resource on a teacher Lesson ─────────────────────────

export async function addOakLessonToLesson(
  lessonId:       string,
  oakLessonSlug:  string,
): Promise<void> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { schoolId, id: userId } = session.user as any

  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, schoolId } })
  if (!lesson) throw new Error('Lesson not found')

  const oakLesson = await prisma.oakLesson.findUnique({ where: { slug: oakLessonSlug } })
  if (!oakLesson) throw new Error('Oak lesson not found')

  await prisma.resource.create({
    data: {
      schoolId,
      lessonId,
      type:        ResourceType.LINK,
      label:       `Oak: ${oakLesson.title}`,
      url:         `https://www.thenational.academy/teachers/lessons/${oakLessonSlug}`,
      oakContentId: oakLessonSlug,
      createdBy:   userId,
    },
  })

  revalidatePath('/dashboard')
}
