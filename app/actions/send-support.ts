'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { analyseStudentPatterns } from '@/lib/send/early-warning'
import { analyseConcernPattern } from '@/lib/send/concern-analyser'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConcernRow = {
  id: string
  studentId: string
  studentName: string
  raisedBy: string
  raiserName: string
  source: string
  category: string
  description: string
  evidenceNotes: string | null
  status: string
  aiAnalysis: string | null
  createdAt: Date
  reviewedAt: Date | null
  reviewNotes: string | null
}

export type IlpWithTargets = {
  id: string
  studentId: string
  studentName: string
  sendCategory: string
  currentStrengths: string
  areasOfNeed: string
  targets: {
    id: string
    target: string
    strategy: string
    successMeasure: string
    targetDate: Date
    status: string
    progressNotes: string | null
  }[]
  strategies: string[]
  successCriteria: string
  reviewDate: Date
  status: string
  parentConsent: boolean
  createdAt: Date
}

export type SendNotificationRow = {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: Date
  concernId: string | null
}

export type EarlyWarningFlagRow = {
  id: string
  studentId: string
  studentName: string
  flagType: string
  severity: string
  description: string
  dataPoints: unknown
  isActioned: boolean
  createdAt: Date
  expiresAt: Date
}

export type SencoDashboardData = {
  openConcerns: number
  highSeverityFlags: number
  studentsWithIlp: number
  ilpReviewsDue: number
  recentConcerns: ConcernRow[]
  activeFlags: EarlyWarningFlagRow[]
}

// ─── Guards ───────────────────────────────────────────────────────────────────

async function requireAuth() {
  const session = await auth()
  if (!session) redirect('/login')
  return session.user as {
    id: string; schoolId: string; role: string; firstName: string; lastName: string
  }
}

async function requireSenco() {
  const user = await requireAuth()
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR'].includes(user.role)) redirect('/dashboard')
  return user
}

async function requireSencoOnly() {
  const user = await requireAuth()
  if (!['SENCO'].includes(user.role)) redirect('/dashboard')
  return user
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CONCERN_CATEGORIES = [
  'literacy', 'numeracy', 'behaviour', 'attendance',
  'social_emotional', 'communication', 'physical', 'sensory', 'other',
] as const

const RaiseConcernSchema = z.object({
  studentId:     z.string().min(1),
  category:      z.enum(CONCERN_CATEGORIES, { error: 'Invalid category' }),
  description:   z.string().min(10, 'Please provide at least 10 characters').max(1000),
  evidenceNotes: z.string().max(500).optional(),
})

const IlpTargetSchema = z.object({
  target:         z.string().min(5).max(500),
  strategy:       z.string().min(5).max(500),
  successMeasure: z.string().min(5).max(500),
  targetDate:     z.date(),
})

const CreateIlpSchema = z.object({
  studentId:        z.string().min(1),
  sendCategory:     z.string().min(1).max(100),
  currentStrengths: z.string().min(10).max(1000),
  areasOfNeed:      z.string().min(10).max(1000),
  targets:          z.array(IlpTargetSchema).min(1).max(5),
  strategies:       z.array(z.string().max(200)).max(20),
  successCriteria:  z.string().min(10).max(500),
  reviewDate:       z.date(),
})

// ─── Concern Management ───────────────────────────────────────────────────────

export async function raiseConcern(data: {
  studentId: string
  category: string
  description: string
  evidenceNotes?: string
}): Promise<void> {
  const user = await requireAuth()
  if (!['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'COVER_MANAGER'].includes(user.role)) {
    redirect('/dashboard')
  }

  const validated = RaiseConcernSchema.parse(data)
  const schoolId = user.schoolId

  const concern = await prisma.sendConcern.create({
    data: {
      schoolId,
      studentId: validated.studentId,
      raisedBy: user.id,
      source: 'teacher',
      category: validated.category,
      description: validated.description,
      evidenceNotes: validated.evidenceNotes ?? null,
    },
  })

  await prisma.sendReviewLog.create({
    data: {
      schoolId,
      studentId: validated.studentId,
      action: 'concern_raised',
      actorId: user.id,
      metadata: { concernId: concern.id, category: validated.category },
    },
  })

  // Notify all SENCOs
  const sencos = await prisma.user.findMany({
    where: { schoolId, role: 'SENCO', isActive: true },
    select: { id: true },
  })

  const student = await prisma.user.findUnique({
    where: { id: validated.studentId },
    select: { firstName: true, lastName: true },
  })

  const studentName = student ? `${student.firstName} ${student.lastName}` : 'a student'

  if (sencos.length > 0) {
    await prisma.sendNotification.createMany({
      data: sencos.map(s => ({
        schoolId,
        recipientId: s.id,
        concernId: concern.id,
        type: 'new_concern',
        title: `New SEND concern raised`,
        body: `${user.firstName} ${user.lastName} raised a concern about ${studentName} (${validated.category}).`,
      })),
    })
  }

  // Check if student has 2+ open concerns — if so, also notify HOY
  const openCount = await prisma.sendConcern.count({
    where: { schoolId, studentId: validated.studentId, status: { in: ['open', 'under_review'] } },
  })

  if (openCount >= 3) {
    const hoys = await prisma.user.findMany({
      where: { schoolId, role: 'HEAD_OF_YEAR', isActive: true },
      select: { id: true },
    })
    if (hoys.length > 0) {
      await prisma.sendNotification.createMany({
        data: hoys.map(h => ({
          schoolId,
          recipientId: h.id,
          concernId: concern.id,
          type: 'concern_escalated',
          title: `Multiple SEND concerns: ${studentName}`,
          body: `${studentName} now has ${openCount} open SEND concerns. SENCO has been notified.`,
        })),
      })
    }
  }

  revalidatePath('/senco/concerns')
}

export async function getStudentConcerns(studentId: string): Promise<ConcernRow[]> {
  const user = await requireAuth()
  const allowedRoles = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR', 'TEACHER', 'HEAD_OF_DEPT', 'COVER_MANAGER']
  if (!allowedRoles.includes(user.role)) redirect('/dashboard')

  const schoolId = user.schoolId

  const concerns = await prisma.sendConcern.findMany({
    where: { schoolId, studentId },
    orderBy: { createdAt: 'desc' },
  })

  const userIds = [...new Set([
    ...concerns.map(c => c.studentId),
    ...concerns.map(c => c.raisedBy),
  ])]

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

  return concerns.map(c => ({
    id: c.id,
    studentId: c.studentId,
    studentName: userMap.get(c.studentId) ?? 'Unknown',
    raisedBy: c.raisedBy,
    raiserName: userMap.get(c.raisedBy) ?? 'Unknown',
    source: c.source,
    category: c.category,
    description: c.description,
    evidenceNotes: c.evidenceNotes,
    status: c.status,
    aiAnalysis: c.aiAnalysis,
    createdAt: c.createdAt,
    reviewedAt: c.reviewedAt,
    reviewNotes: c.reviewNotes,
  }))
}

export async function getAllConcerns(filter?: {
  status?: string; category?: string
}): Promise<ConcernRow[]> {
  const user = await requireSenco()
  const schoolId = user.schoolId

  const where: Record<string, unknown> = { schoolId }
  if (filter?.status) where.status = filter.status
  if (filter?.category) where.category = filter.category

  const concerns = await prisma.sendConcern.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const userIds = [...new Set([
    ...concerns.map(c => c.studentId),
    ...concerns.map(c => c.raisedBy),
  ])]

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

  return concerns.map(c => ({
    id: c.id,
    studentId: c.studentId,
    studentName: userMap.get(c.studentId) ?? 'Unknown',
    raisedBy: c.raisedBy,
    raiserName: userMap.get(c.raisedBy) ?? 'Unknown',
    source: c.source,
    category: c.category,
    description: c.description,
    evidenceNotes: c.evidenceNotes,
    status: c.status,
    aiAnalysis: c.aiAnalysis,
    createdAt: c.createdAt,
    reviewedAt: c.reviewedAt,
    reviewNotes: c.reviewNotes,
  }))
}

export async function reviewConcern(
  concernId: string,
  status: string,
  reviewNotes: string,
): Promise<void> {
  const user = await requireSencoOnly()
  const schoolId = user.schoolId

  const concern = await prisma.sendConcern.findFirst({ where: { id: concernId, schoolId } })
  if (!concern) throw new Error('Concern not found')

  await prisma.sendConcern.update({
    where: { id: concernId },
    data: {
      status,
      reviewedBy: user.id,
      reviewedAt: new Date(),
      reviewNotes,
    },
  })

  await prisma.sendReviewLog.create({
    data: {
      schoolId,
      studentId: concern.studentId,
      action: 'concern_reviewed',
      actorId: user.id,
      metadata: { concernId, status, reviewNotes: reviewNotes.slice(0, 200) },
    },
  })

  if (status === 'escalated') {
    const sltHoy = await prisma.user.findMany({
      where: { schoolId, role: { in: ['SLT', 'HEAD_OF_YEAR'] }, isActive: true },
      select: { id: true },
    })
    if (sltHoy.length > 0) {
      const student = await prisma.user.findUnique({
        where: { id: concern.studentId },
        select: { firstName: true, lastName: true },
      })
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'a student'
      await prisma.sendNotification.createMany({
        data: sltHoy.map(u => ({
          schoolId,
          recipientId: u.id,
          concernId,
          type: 'concern_escalated',
          title: `SEND concern escalated: ${studentName}`,
          body: `SENCO has escalated a ${concern.category} concern about ${studentName}. Review notes: ${reviewNotes.slice(0, 150)}`,
        })),
      })
    }
  }

  revalidatePath('/senco/concerns')
}

export async function requestAiAnalysis(concernId: string): Promise<string> {
  const user = await requireSencoOnly()
  const schoolId = user.schoolId

  const concern = await prisma.sendConcern.findFirst({ where: { id: concernId, schoolId } })
  if (!concern) throw new Error('Concern not found')

  const analysis = await analyseConcernPattern(concern.studentId, schoolId)

  await prisma.sendConcern.update({
    where: { id: concernId },
    data: { aiAnalysis: analysis },
  })

  revalidatePath('/senco/concerns')
  return analysis
}

// ─── ILP Management ───────────────────────────────────────────────────────────

export async function createIlp(data: {
  studentId: string
  sendCategory: string
  currentStrengths: string
  areasOfNeed: string
  targets: { target: string; strategy: string; successMeasure: string; targetDate: Date }[]
  strategies: string[]
  successCriteria: string
  reviewDate: Date
}): Promise<void> {
  const user = await requireSencoOnly()
  const schoolId = user.schoolId

  const validated = CreateIlpSchema.parse(data)

  // Archive any existing active ILPs for this student
  await prisma.individualLearningPlan.updateMany({
    where: { schoolId, studentId: validated.studentId, status: 'active' },
    data: { status: 'archived' },
  })

  const ilp = await prisma.individualLearningPlan.create({
    data: {
      schoolId,
      studentId: validated.studentId,
      createdBy: user.id,
      sendCategory: validated.sendCategory,
      currentStrengths: validated.currentStrengths,
      areasOfNeed: validated.areasOfNeed,
      strategies: validated.strategies,
      successCriteria: validated.successCriteria,
      reviewDate: validated.reviewDate,
      targets: {
        create: validated.targets.map(t => ({
          target: t.target,
          strategy: t.strategy,
          successMeasure: t.successMeasure,
          targetDate: t.targetDate,
        })),
      },
    },
  })

  await prisma.sendReviewLog.create({
    data: {
      schoolId,
      studentId: validated.studentId,
      action: 'ilp_created',
      actorId: user.id,
      metadata: { ilpId: ilp.id, sendCategory: validated.sendCategory },
    },
  })

  // Notify teachers of the student + HOY
  const classTeachers = await prisma.classTeacher.findMany({
    where: {
      class: {
        enrolments: { some: { userId: validated.studentId } },
        schoolId,
      },
    },
    select: { userId: true },
  })

  const hoys = await prisma.user.findMany({
    where: { schoolId, role: 'HEAD_OF_YEAR', isActive: true },
    select: { id: true },
  })

  const notifyIds = [...new Set([
    ...classTeachers.map(ct => ct.userId),
    ...hoys.map(h => h.id),
  ])]

  const student = await prisma.user.findUnique({
    where: { id: validated.studentId },
    select: { firstName: true, lastName: true },
  })
  const studentName = student ? `${student.firstName} ${student.lastName}` : 'a student'

  if (notifyIds.length > 0) {
    await prisma.sendNotification.createMany({
      data: notifyIds.map(recipientId => ({
        schoolId,
        recipientId,
        type: 'ilp_created',
        title: `ILP created: ${studentName}`,
        body: `A new Individual Learning Plan has been created for ${studentName} (${validated.sendCategory}). Please review SEND strategies in your lesson planning.`,
      })),
    })
  }

  revalidatePath('/senco/ilp')
}

export async function getStudentIlp(studentId: string): Promise<IlpWithTargets | null> {
  const user = await requireAuth()
  const allowedRoles = ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR', 'TEACHER', 'HEAD_OF_DEPT']
  if (!allowedRoles.includes(user.role)) redirect('/dashboard')

  const ilp = await prisma.individualLearningPlan.findFirst({
    where: { schoolId: user.schoolId, studentId, status: 'active' },
    include: { targets: { orderBy: { targetDate: 'asc' } } },
  })
  if (!ilp) return null

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { firstName: true, lastName: true },
  })

  return {
    id: ilp.id,
    studentId: ilp.studentId,
    studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
    sendCategory: ilp.sendCategory,
    currentStrengths: ilp.currentStrengths,
    areasOfNeed: ilp.areasOfNeed,
    targets: ilp.targets.map(t => ({
      id: t.id,
      target: t.target,
      strategy: t.strategy,
      successMeasure: t.successMeasure,
      targetDate: t.targetDate,
      status: t.status,
      progressNotes: t.progressNotes,
    })),
    strategies: ilp.strategies,
    successCriteria: ilp.successCriteria,
    reviewDate: ilp.reviewDate,
    status: ilp.status,
    parentConsent: ilp.parentConsent,
    createdAt: ilp.createdAt,
  }
}

export async function getAllIlps(): Promise<IlpWithTargets[]> {
  const user = await requireSenco()
  const schoolId = user.schoolId

  const ilps = await prisma.individualLearningPlan.findMany({
    where: { schoolId, status: { not: 'archived' } },
    include: { targets: { orderBy: { targetDate: 'asc' } } },
    orderBy: { reviewDate: 'asc' },
  })

  const studentIds = [...new Set(ilps.map(i => i.studentId))]
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const studentMap = new Map(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]))

  return ilps.map(ilp => ({
    id: ilp.id,
    studentId: ilp.studentId,
    studentName: studentMap.get(ilp.studentId) ?? 'Unknown',
    sendCategory: ilp.sendCategory,
    currentStrengths: ilp.currentStrengths,
    areasOfNeed: ilp.areasOfNeed,
    targets: ilp.targets.map(t => ({
      id: t.id,
      target: t.target,
      strategy: t.strategy,
      successMeasure: t.successMeasure,
      targetDate: t.targetDate,
      status: t.status,
      progressNotes: t.progressNotes,
    })),
    strategies: ilp.strategies,
    successCriteria: ilp.successCriteria,
    reviewDate: ilp.reviewDate,
    status: ilp.status,
    parentConsent: ilp.parentConsent,
    createdAt: ilp.createdAt,
  }))
}

export async function updateIlpTarget(
  targetId: string,
  status: string,
  progressNotes: string,
): Promise<void> {
  const user = await requireAuth()
  const allowedRoles = ['SENCO', 'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN']
  if (!allowedRoles.includes(user.role)) redirect('/dashboard')

  await prisma.ilpTarget.update({
    where: { id: targetId },
    data: { status, progressNotes, reviewedAt: new Date() },
  })

  revalidatePath('/senco/ilp')
}

export async function scheduleIlpReview(ilpId: string, reviewDate: Date): Promise<void> {
  const user = await requireSencoOnly()
  const schoolId = user.schoolId

  const ilp = await prisma.individualLearningPlan.findFirst({
    where: { id: ilpId, schoolId },
  })
  if (!ilp) throw new Error('ILP not found')

  await prisma.individualLearningPlan.update({
    where: { id: ilpId },
    data: { reviewDate },
  })

  const student = await prisma.user.findUnique({
    where: { id: ilp.studentId },
    select: { firstName: true, lastName: true },
  })
  const studentName = student ? `${student.firstName} ${student.lastName}` : 'student'

  // Notify self (SENCO) 7 days before review
  const reminderDate = new Date(reviewDate)
  reminderDate.setDate(reminderDate.getDate() - 7)

  await prisma.sendNotification.create({
    data: {
      schoolId,
      recipientId: user.id,
      type: 'ilp_review_due',
      title: `ILP review due: ${studentName}`,
      body: `Reminder: ILP review for ${studentName} is scheduled for ${reviewDate.toLocaleDateString('en-GB')}.`,
    },
  })

  revalidatePath('/senco/ilp')
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getMyNotifications(): Promise<SendNotificationRow[]> {
  const user = await requireAuth()
  return prisma.sendNotification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await requireAuth()
  await prisma.sendNotification.updateMany({
    where: { id: notificationId, recipientId: user.id },
    data: { isRead: true },
  })
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireAuth()
  await prisma.sendNotification.updateMany({
    where: { recipientId: user.id, isRead: false },
    data: { isRead: true },
  })
}

export async function getUnreadCount(): Promise<number> {
  const user = await requireAuth()
  return prisma.sendNotification.count({
    where: { recipientId: user.id, isRead: false },
  })
}

// ─── Early Warning ────────────────────────────────────────────────────────────

export async function getEarlyWarningFlags(): Promise<EarlyWarningFlagRow[]> {
  const user = await requireSenco()
  const schoolId = user.schoolId
  const now = new Date()

  const flags = await prisma.earlyWarningFlag.findMany({
    where: { schoolId, isActioned: false, expiresAt: { gte: now } },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  })

  const studentIds = [...new Set(flags.map(f => f.studentId))]
  const students = await prisma.user.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const studentMap = new Map(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]))

  return flags.map(f => ({
    id: f.id,
    studentId: f.studentId,
    studentName: studentMap.get(f.studentId) ?? 'Unknown',
    flagType: f.flagType,
    severity: f.severity,
    description: f.description,
    dataPoints: f.dataPoints,
    isActioned: f.isActioned,
    createdAt: f.createdAt,
    expiresAt: f.expiresAt,
  }))
}

export async function actionFlag(flagId: string, notes: string): Promise<void> {
  const user = await requireSenco()
  const schoolId = user.schoolId

  const flag = await prisma.earlyWarningFlag.findFirst({ where: { id: flagId, schoolId } })
  if (!flag) throw new Error('Flag not found')

  await prisma.earlyWarningFlag.update({
    where: { id: flagId },
    data: { isActioned: true, actionedBy: user.id, actionedAt: new Date() },
  })

  await prisma.sendReviewLog.create({
    data: {
      schoolId,
      studentId: flag.studentId,
      action: 'concern_reviewed',
      actorId: user.id,
      metadata: { flagId, flagType: flag.flagType, notes: notes.slice(0, 200) },
    },
  })

  revalidatePath('/senco/early-warning')
}

export async function triggerEarlyWarningAnalysis(): Promise<{ flagsCreated: number }> {
  const user = await requireSenco()
  const flagsCreated = await analyseStudentPatterns(user.schoolId)
  revalidatePath('/senco/early-warning')
  return { flagsCreated }
}

// ─── SENCO Dashboard ──────────────────────────────────────────────────────────

export async function getSencoDashboardData(): Promise<SencoDashboardData> {
  const user = await requireSenco()
  const schoolId = user.schoolId
  const now = new Date()
  const in14Days = new Date(now)
  in14Days.setDate(now.getDate() + 14)

  const [
    openConcerns,
    highSeverityFlags,
    studentsWithIlp,
    ilpReviewsDue,
    recentConcernsRaw,
    activeFlagsRaw,
  ] = await Promise.all([
    prisma.sendConcern.count({ where: { schoolId, status: { in: ['open', 'under_review'] } } }),
    prisma.earlyWarningFlag.count({ where: { schoolId, severity: 'high', isActioned: false, expiresAt: { gte: now } } }),
    prisma.individualLearningPlan.count({ where: { schoolId, status: 'active' } }),
    prisma.individualLearningPlan.count({ where: { schoolId, status: 'active', reviewDate: { gte: now, lte: in14Days } } }),
    prisma.sendConcern.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.earlyWarningFlag.findMany({
      where: { schoolId, isActioned: false, expiresAt: { gte: now } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
  ])

  const userIds = [...new Set([
    ...recentConcernsRaw.map(c => c.studentId),
    ...recentConcernsRaw.map(c => c.raisedBy),
    ...activeFlagsRaw.map(f => f.studentId),
  ])]
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const userMap = new Map(users.map(u => [u.id, `${u.firstName} ${u.lastName}`]))

  return {
    openConcerns,
    highSeverityFlags,
    studentsWithIlp,
    ilpReviewsDue,
    recentConcerns: recentConcernsRaw.map(c => ({
      id: c.id,
      studentId: c.studentId,
      studentName: userMap.get(c.studentId) ?? 'Unknown',
      raisedBy: c.raisedBy,
      raiserName: userMap.get(c.raisedBy) ?? 'Unknown',
      source: c.source,
      category: c.category,
      description: c.description,
      evidenceNotes: c.evidenceNotes,
      status: c.status,
      aiAnalysis: c.aiAnalysis,
      createdAt: c.createdAt,
      reviewedAt: c.reviewedAt,
      reviewNotes: c.reviewNotes,
    })),
    activeFlags: activeFlagsRaw.map(f => ({
      id: f.id,
      studentId: f.studentId,
      studentName: userMap.get(f.studentId) ?? 'Unknown',
      flagType: f.flagType,
      severity: f.severity,
      description: f.description,
      dataPoints: f.dataPoints,
      isActioned: f.isActioned,
      createdAt: f.createdAt,
      expiresAt: f.expiresAt,
    })),
  }
}

// ─── Student SEND overview (for teacher lesson views) ────────────────────────

export type StudentSendSummary = {
  userId: string
  name: string
  hasSendStatus: boolean
  sendStatus: string | null
  openConcerns: number
  hasActiveIlp: boolean
  ilpStrategies: string[]
  hasWarningFlag: boolean
}

export async function getClassSendSummaries(classId: string): Promise<StudentSendSummary[]> {
  const user = await requireAuth()
  const allowedRoles = ['TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN', 'COVER_MANAGER']
  if (!allowedRoles.includes(user.role)) return []

  const schoolId = user.schoolId
  const now = new Date()

  // Get students in this class
  const enrolments = await prisma.enrolment.findMany({
    where: { classId, class: { schoolId } },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  })

  const studentIds = enrolments.map(e => e.userId)
  if (studentIds.length === 0) return []

  const [sendStatuses, openConcernCounts, activeIlps, warningFlags] = await Promise.all([
    prisma.sendStatus.findMany({
      where: { studentId: { in: studentIds } },
      select: { studentId: true, activeStatus: true },
    }),
    prisma.sendConcern.groupBy({
      by: ['studentId'],
      where: { schoolId, studentId: { in: studentIds }, status: { in: ['open', 'under_review'] } },
      _count: { id: true },
    }),
    prisma.individualLearningPlan.findMany({
      where: { schoolId, studentId: { in: studentIds }, status: 'active' },
      select: { studentId: true, strategies: true },
    }),
    prisma.earlyWarningFlag.findMany({
      where: { schoolId, studentId: { in: studentIds }, isActioned: false, expiresAt: { gte: now } },
      select: { studentId: true },
    }),
  ])

  const statusMap = new Map(sendStatuses.map(s => [s.studentId, s.activeStatus as string]))
  const concernMap = new Map(openConcernCounts.map(c => [c.studentId, c._count.id]))
  const ilpMap = new Map(activeIlps.map(i => [i.studentId, i.strategies]))
  const flagSet = new Set(warningFlags.map(f => f.studentId))

  return enrolments.map(e => {
    const sendStatus = statusMap.get(e.userId) ?? null
    return {
      userId: e.userId,
      name: `${e.user.firstName} ${e.user.lastName}`,
      hasSendStatus: sendStatus !== null && sendStatus !== 'NONE',
      sendStatus,
      openConcerns: concernMap.get(e.userId) ?? 0,
      hasActiveIlp: ilpMap.has(e.userId),
      ilpStrategies: ilpMap.get(e.userId) ?? [],
      hasWarningFlag: flagSet.has(e.userId),
    }
  })
}
