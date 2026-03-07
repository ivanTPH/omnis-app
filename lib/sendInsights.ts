import { prisma } from '@/lib/prisma'

export async function updateSendInsight(params: {
  schoolId:     string
  lessonId:     string
  resourceType: string
}): Promise<void> {
  // Resolve subject + yearGroup from the lesson's class
  const lesson = await prisma.lesson.findUnique({
    where:  { id: params.lessonId },
    select: { class: { select: { subject: true, yearGroup: true } } },
  })
  const cls = lesson?.class
  if (!cls) return  // out-of-hours lesson — no class context to aggregate against

  // Aggregate all reviewed resources of this type for the school/subject/yearGroup
  const agg = await prisma.resourceReview.aggregate({
    where: {
      resource: {
        schoolId: params.schoolId,
        type:     params.resourceType as any,
        lesson: {
          class: {
            schoolId:  params.schoolId,
            subject:   cls.subject,
            yearGroup: cls.yearGroup,
          },
        },
      },
    },
    _avg:   { sendScore: true },
    _min:   { sendScore: true },
    _max:   { sendScore: true },
    _count: { sendScore: true },
  })

  if (!agg._count.sendScore) return

  await prisma.sendInsight.upsert({
    where: {
      schoolId_subject_yearGroup_resourceType: {
        schoolId:     params.schoolId,
        subject:      cls.subject,
        yearGroup:    cls.yearGroup,
        resourceType: params.resourceType,
      },
    },
    create: {
      schoolId:       params.schoolId,
      subject:        cls.subject,
      yearGroup:      cls.yearGroup,
      resourceType:   params.resourceType,
      avgScore:       agg._avg.sendScore ?? 0,
      minScore:       agg._min.sendScore ?? 0,
      maxScore:       agg._max.sendScore ?? 0,
      totalResources: agg._count.sendScore,
    },
    update: {
      avgScore:       agg._avg.sendScore ?? 0,
      minScore:       agg._min.sendScore ?? 0,
      maxScore:       agg._max.sendScore ?? 0,
      totalResources: agg._count.sendScore,
    },
  })
}
