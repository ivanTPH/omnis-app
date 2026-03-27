'use server'
import { auth }           from '@/lib/auth'
import { prisma, writeAudit } from '@/lib/prisma'
import { revalidatePath }  from 'next/cache'

function requireAuth() {
  return auth().then(s => {
    if (!s) throw new Error('Unauthenticated')
    return s.user as { id: string; schoolId: string; role: string; firstName: string; lastName: string }
  })
}

const SENCO_TIER  = ['SENCO', 'SLT', 'SCHOOL_ADMIN']
const TEACHER_TIER = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR']

// ── Scoped student IDs ────────────────────────────────────────────────────────

async function getScopedStudentIds(schoolId: string, userId: string, role: string) {
  if (SENCO_TIER.includes(role)) {
    const students = await prisma.user.findMany({
      where:  { schoolId, role: 'STUDENT' },
      select: { id: true },
    })
    return students.map(s => s.id)
  }
  // Teachers / HOD / HOY — only students in their classes
  const classTeachers = await prisma.classTeacher.findMany({
    where:  { userId, class: { schoolId } },
    select: { classId: true },
  })
  if (classTeachers.length === 0) return []
  const enrolments = await prisma.enrolment.findMany({
    where:  { classId: { in: classTeachers.map(ct => ct.classId) } },
    select: { userId: true },
  })
  return [...new Set(enrolments.map(e => e.userId))]
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanNote = {
  id:        string
  note:      string
  createdAt: string   // ISO
  teacherName: string
}

export type IlpRow = {
  id:           string
  status:       string
  sendCategory: string
  areasOfNeed:  string
  reviewDate:   string   // ISO
  student:      { id: string; firstName: string; lastName: string }
  targets:      { id: string; status: string }[]
  notes:        PlanNote[]
}

export type EhcpRow = {
  id:             string
  status:         string
  localAuthority: string
  reviewDate:     string   // ISO
  student:        { id: string; firstName: string; lastName: string }
  notes:          PlanNote[]
}

export type KPlanRow = {
  id:         string
  status:     string
  reviewDate: string   // ISO
  student:    { id: string; firstName: string; lastName: string }
  notes:      PlanNote[]
}

export type PlansData = {
  ilps:    IlpRow[]
  ehcps:   EhcpRow[]
  kplans:  KPlanRow[]
  sencoId: string | null
}

// ── getPlansData ──────────────────────────────────────────────────────────────

export async function getPlansData(): Promise<PlansData> {
  const user = await requireAuth()
  const { id: userId, schoolId, role } = user

  const studentIds = await getScopedStudentIds(schoolId, userId, role)
  if (studentIds.length === 0) return { ilps: [], ehcps: [], kplans: [], sencoId: null }

  // Find school SENCO (any SENCO in this school)
  const senco = await prisma.user.findFirst({
    where:  { schoolId, role: 'SENCO' },
    select: { id: true },
  })

  const [rawIlps, rawEhcps, rawKplans] = await Promise.all([
    prisma.individualLearningPlan.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status:    { in: ['active', 'under_review'] },
      },
      select: {
        id:           true,
        status:       true,
        sendCategory: true,
        areasOfNeed:  true,
        reviewDate:   true,
        student:      { select: { id: true, firstName: true, lastName: true } },
        targets:      { select: { id: true, status: true }, take: 3 },
      },
      orderBy: { reviewDate: 'asc' },
    }),
    prisma.ehcpPlan.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status:    { in: ['active', 'under_review'] },
      },
      select: {
        id:             true,
        status:         true,
        localAuthority: true,
        reviewDate:     true,
        student:        { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { reviewDate: 'asc' },
    }),
    prisma.plan.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status:    { in: ['ACTIVE_INTERNAL', 'ACTIVE_PARENT_SHARED'] },
      },
      select: {
        id:         true,
        status:     true,
        reviewDate: true,
        student:    { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { reviewDate: 'asc' },
    }),
  ])

  // Fetch notes for all plan IDs
  const allPlanIds = [
    ...rawIlps.map(i => i.id),
    ...rawEhcps.map(e => e.id),
    ...rawKplans.map(k => k.id),
  ]
  const rawNotes = allPlanIds.length > 0
    ? await prisma.teacherPlanNote.findMany({
        where:   { planId: { in: allPlanIds }, schoolId },
        select:  {
          id:        true,
          planId:    true,
          note:      true,
          createdAt: true,
          teacher:   { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : []

  function notesFor(planId: string): PlanNote[] {
    return rawNotes
      .filter(n => n.planId === planId)
      .map(n => ({
        id:          n.id,
        note:        n.note,
        createdAt:   n.createdAt.toISOString(),
        teacherName: `${n.teacher.firstName} ${n.teacher.lastName}`,
      }))
  }

  return {
    ilps: rawIlps.map(i => ({
      ...i,
      reviewDate: i.reviewDate.toISOString(),
      notes:      notesFor(i.id),
    })),
    ehcps: rawEhcps.map(e => ({
      ...e,
      reviewDate: e.reviewDate.toISOString(),
      notes:      notesFor(e.id),
    })),
    kplans: rawKplans.map(k => ({
      ...k,
      status:     k.status.toString(),
      reviewDate: k.reviewDate.toISOString(),
      notes:      notesFor(k.id),
    })),
    sencoId: senco?.id ?? null,
  }
}

// ── savePlanNote ──────────────────────────────────────────────────────────────

export async function savePlanNote(planType: string, planId: string, note: string) {
  const user = await requireAuth()
  const { id: teacherId, schoolId } = user
  if (!note.trim()) throw new Error('Note cannot be empty')

  await prisma.teacherPlanNote.create({
    data: { planType, planId, teacherId, schoolId, note: note.trim() },
  })
  await writeAudit({
    schoolId,
    actorId:    teacherId,
    action:     'PLAN_NOTE_ADDED',
    targetType: 'PLAN',
    targetId:   planId,
    metadata:   { planType },
  })
  revalidatePath('/plans')
}

// ── messageSencoAboutPlan ─────────────────────────────────────────────────────

export async function messageSencoAboutPlan(
  sencoId:     string,
  studentName: string,
  planType:    string,
): Promise<{ threadId: string }> {
  const user = await requireAuth()
  const { id: userId, schoolId } = user

  // Verify SENCO is in same school
  const senco = await prisma.user.findFirst({
    where:  { id: sencoId, schoolId },
    select: { id: true },
  })
  if (!senco) throw new Error('SENCO not found')

  const planLabel = planType === 'ilp' ? 'ILP' : planType === 'ehcp' ? 'EHCP' : 'K Plan'
  const subject   = `${planLabel} — ${studentName}`
  const body      = `Hi, I'd like to discuss the ${planLabel} for ${studentName}. Could we arrange a time to talk?`

  // Check if an existing thread between these two already exists with this context
  // (just create a new thread — simpler, avoids complex de-dup logic)
  const thread = await prisma.msgThread.create({
    data: {
      schoolId,
      subject,
      createdBy: userId,
      participants: {
        create: [
          { userId },
          { userId: sencoId },
        ],
      },
      messages: {
        create: {
          senderId: userId,
          body,
        },
      },
    },
    select: { id: true },
  })

  revalidatePath('/messages')
  return { threadId: thread.id }
}
