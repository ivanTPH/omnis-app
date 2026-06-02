'use server'

import { requireAuth } from '@/lib/session'
import { prisma, writeAudit }  from '@/lib/prisma'
import Anthropic               from '@anthropic-ai/sdk'

// ── Request ILP evidence from subject teachers ────────────────────────────────

export async function requestILPEvidence(
  studentId: string,
): Promise<{ success: boolean; teachersNotified?: number; error?: string }> {
  const { schoolId, id: actorId, role } = await requireAuth()

  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(role)) {
    return { success: false, error: 'Only SENCO can request ILP evidence' }
  }

  const student = await prisma.user.findFirst({
    where:  { id: studentId, schoolId, role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!student) return { success: false, error: 'Student not found' }

  // Count ILP targets that have no evidence yet
  const ilp = await prisma.individualLearningPlan.findFirst({
    where:  { studentId, schoolId, status: 'active' },
    select: { targets: { where: { status: 'active' }, select: { id: true } } },
  })
  const allTargetIds: string[] = ilp?.targets.map((t: any) => t.id) ?? []
  let gapCount = allTargetIds.length
  if (allTargetIds.length > 0) {
    const linked = await prisma.ilpHomeworkLink.findMany({
      where:  { ilpTargetId: { in: allTargetIds } },
      select: { ilpTargetId: true },
    })
    const linkedSet = new Set(linked.map(l => l.ilpTargetId))
    gapCount = allTargetIds.filter(id => !linkedSet.has(id)).length
  }

  // Find all teachers for this student via class enrolments
  const enrolments = await prisma.enrolment.findMany({
    where:  { userId: studentId },
    select: { classId: true },
  })
  const classIds = enrolments.map(e => e.classId)
  if (classIds.length === 0) return { success: false, error: 'Student is not enrolled in any classes' }

  const classTeachers = await prisma.classTeacher.findMany({
    where:  { classId: { in: classIds } },
    select: { userId: true },
  })
  const teacherIds = [...new Set(classTeachers.map(ct => ct.userId))]
  if (teacherIds.length === 0) return { success: false, error: 'No teachers found for this student' }

  // Deduplicate — don't re-send if already sent today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const alreadySent = await prisma.notification.findFirst({
    where: {
      schoolId,
      type:    'ILP_EVIDENCE_REQUEST',
      linkHref: `/homework`,
      userId:  { in: teacherIds },
      createdAt: { gte: todayStart },
    },
  })
  if (alreadySent) return { success: true, teachersNotified: 0 }

  const actor = await prisma.user.findUnique({
    where:  { id: actorId },
    select: { firstName: true, lastName: true },
  })
  const sencoName = actor ? `${actor.firstName} ${actor.lastName}` : 'SENCO'
  const targetWord = gapCount !== 1 ? 'targets' : 'target'

  await prisma.notification.createMany({
    data: teacherIds.map(uid => ({
      schoolId,
      userId:   uid,
      type:     'ILP_EVIDENCE_REQUEST',
      title:    `ILP evidence request — ${student.firstName} ${student.lastName}`,
      body:     `${sencoName} (SENCO) is asking you to review ${student.firstName}'s recent homework and link any submissions that evidence their ILP ${targetWord}. ${gapCount} ${targetWord} currently ${gapCount !== 1 ? 'have' : 'has'} no linked evidence.`,
      linkHref: `/homework`,
    })),
  })

  await writeAudit({
    schoolId,
    actorId,
    action:     'ILP_EVIDENCE_REQUESTED',
    targetType: 'STUDENT',
    targetId:   studentId,
    metadata:   { teachersNotified: teacherIds.length, gapCount },
  })

  return { success: true, teachersNotified: teacherIds.length }
}

// ── Proactive ILP evidence match check (called after marking) ─────────────────
// Fire-and-forget: called with void, must not throw.

export async function checkILPEvidenceMatch({
  submissionId,
  studentId,
  ilpTargets,
  homeworkTitle,
  subject,
  grade,
  schoolId,
  teacherId,
  homeworkId,
}: {
  submissionId:  string
  studentId:     string
  ilpTargets:    Array<{ id: string; description: string }>
  homeworkTitle: string
  subject:       string
  grade:         string
  schoolId:      string
  teacherId:     string
  homeworkId:    string
}): Promise<void> {
  try {
    // Only flag passing grades (4+) — no point linking a failing submission
    const gradeNum = parseInt(grade, 10)
    if (!isNaN(gradeNum) && gradeNum < 4) return
    if (ilpTargets.length === 0) return

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return

    const targetsText = ilpTargets.map((t, i) => `${i + 1}. ${t.description}`).join('\n')
    const prompt = `A student has just had homework graded.

Homework title: "${homeworkTitle}"
Subject: ${subject || 'Not specified'}
Grade: ${grade || 'Not graded'} (GCSE 1–9)

Active ILP targets:
${targetsText}

Does this homework likely provide evidence toward any of these ILP targets?

Respond with ONLY valid JSON (no markdown):
{"match": true/false, "targetIndices": [1, 2], "rationale": "one sentence"}

If no match: {"match": false, "targetIndices": [], "rationale": ""}`

    const client = new Anthropic({ apiKey })
    const msg    = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text   = (msg.content[0] as any).text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    const result = JSON.parse(text)

    if (!result.match || !Array.isArray(result.targetIndices) || result.targetIndices.length === 0) return

    const matchingTarget = ilpTargets[result.targetIndices[0] - 1]
    if (!matchingTarget) return

    const student = await prisma.user.findUnique({
      where:  { id: studentId },
      select: { firstName: true, lastName: true },
    })
    if (!student) return

    const linkHref = `/homework/${homeworkId}/mark`

    // Avoid duplicate notifications for this homework marking page
    const alreadyNotified = await prisma.notification.findFirst({
      where: { schoolId, userId: teacherId, type: 'ILP_EVIDENCE_SUGGESTED', linkHref },
    })
    if (alreadyNotified) return

    await prisma.notification.create({
      data: {
        schoolId,
        userId:   teacherId,
        type:     'ILP_EVIDENCE_SUGGESTED',
        title:    `ILP evidence opportunity — ${student.firstName} ${student.lastName}`,
        body:     `"${homeworkTitle}" (Grade ${grade}) may evidence ${student.firstName}'s ILP target: "${matchingTarget.description}". ${result.rationale} Open the marking view to record it.`,
        linkHref,
      },
    })
  } catch {
    // Background enhancement — fail silently
    console.error('[checkILPEvidenceMatch] failed', submissionId)
  }
}

// ── Proactive EHCP evidence match check (called after marking) ────────────────
// Fire-and-forget: must not throw.

export async function checkEhcpEvidenceMatch({
  submissionId,
  studentId,
  ehcpOutcomes,
  homeworkTitle,
  subject,
  grade,
  schoolId,
  teacherId,
  homeworkId,
}: {
  submissionId:  string
  studentId:     string
  ehcpOutcomes:  Array<{ id: string; outcomeText: string; section: string }>
  homeworkTitle: string
  subject:       string
  grade:         string
  schoolId:      string
  teacherId:     string
  homeworkId:    string
}): Promise<void> {
  try {
    const gradeNum = parseInt(grade, 10)
    if (!isNaN(gradeNum) && gradeNum < 4) return
    if (ehcpOutcomes.length === 0) return

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return

    const outcomesText = ehcpOutcomes.map((o, i) => `${i + 1}. [Section ${o.section}] ${o.outcomeText}`).join('\n')
    const prompt = `A student has just had homework graded.

Homework title: "${homeworkTitle}"
Subject: ${subject || 'Not specified'}
Grade: ${grade} (GCSE 1–9 scale)

Active EHCP outcomes:
${outcomesText}

Does this homework likely provide evidence toward any of these EHCP outcomes?

Respond with ONLY valid JSON (no markdown):
{"match": true/false, "outcomeIndex": 1, "rationale": "one sentence"}

If no match: {"match": false, "outcomeIndex": 0, "rationale": ""}`

    const client = new Anthropic({ apiKey })
    const msg    = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages:   [{ role: 'user', content: prompt }],
    })
    const text   = (msg.content[0] as any).text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    const result = JSON.parse(text)

    if (!result.match || !result.outcomeIndex) return

    const matchingOutcome = ehcpOutcomes[result.outcomeIndex - 1]
    if (!matchingOutcome) return

    const student = await prisma.user.findUnique({
      where:  { id: studentId },
      select: { firstName: true, lastName: true },
    })
    if (!student) return

    const linkHref = `/homework/${homeworkId}/mark`

    const alreadyNotified = await prisma.notification.findFirst({
      where: { schoolId, userId: teacherId, type: 'EHCP_EVIDENCE_SUGGESTED', linkHref },
    })
    if (alreadyNotified) return

    await prisma.notification.create({
      data: {
        schoolId,
        userId:   teacherId,
        type:     'EHCP_EVIDENCE_SUGGESTED',
        title:    `EHCP evidence opportunity — ${student.firstName} ${student.lastName}`,
        body:     `"${homeworkTitle}" (Grade ${grade}) may evidence ${student.firstName}'s EHCP outcome: "${matchingOutcome.outcomeText.slice(0, 100)}…". ${result.rationale} You can link this from the EHCP Plans page.`,
        linkHref,
      },
    })
  } catch {
    console.error('[checkEhcpEvidenceMatch] failed', submissionId)
  }
}
