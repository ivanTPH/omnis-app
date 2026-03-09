'use server'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ─── Guard ────────────────────────────────────────────────────────────────────

async function requirePlatformAdmin() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = session.user as any
  if (u.role !== 'PLATFORM_ADMIN') redirect('/dashboard')
  return u
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformStats = {
  totalSchools: number
  activeSchools: number
  totalStudents: number
  totalStaff: number
  totalOakLessons: number
  totalSendScores: number
  totalConsentRecords: number
}

export type SchoolRow = {
  id: string
  name: string
  urn: string | null
  phase: string | null
  region: string | null
  localAuthority: string | null
  isActive: boolean
  onboardedAt: Date | null
  createdAt: Date
  studentCount: number
  staffCount: number
  activeFlags: string[]
}

export type FeatureFlagRow = {
  id: string
  flag: string
  enabled: boolean
  setAt: Date
}

export type AuditLogRow = {
  id: string
  actorId: string
  actorName: string
  action: string
  target: string | null
  metadata: unknown
  createdAt: Date
}

export type WeeklyUsageStat = {
  week: string   // "W10 2026"
  isoWeek: string // "2026-W10" for sorting
  oakAdditions: number
  sendScores: number
  consentRecords: number
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getPlatformStats(): Promise<PlatformStats> {
  await requirePlatformAdmin()
  const [
    totalSchools,
    activeSchools,
    totalStudents,
    totalStaff,
    totalOakLessons,
    totalSendScores,
    totalConsentRecords,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { isActive: true } }),
    prisma.wondeStudent.count(),
    prisma.wondeEmployee.count(),
    prisma.oakLesson.count(),
    prisma.sendQualityScore.count(),
    prisma.consentRecord.count(),
  ])
  return { totalSchools, activeSchools, totalStudents, totalStaff, totalOakLessons, totalSendScores, totalConsentRecords }
}

// ─── School list ──────────────────────────────────────────────────────────────

export async function getSchoolList(): Promise<SchoolRow[]> {
  await requirePlatformAdmin()
  const schools = await prisma.school.findMany({
    orderBy: { name: 'asc' },
    include: {
      featureFlags: { where: { enabled: true }, select: { flag: true } },
      _count: {
        select: {
          wondeStudents: true,
          wondeEmployees: true,
        },
      },
    },
  })
  return schools.map(s => ({
    id: s.id,
    name: s.name,
    urn: s.urn,
    phase: s.phase,
    region: s.region,
    localAuthority: s.localAuthority,
    isActive: s.isActive,
    onboardedAt: s.onboardedAt,
    createdAt: s.createdAt,
    studentCount: s._count.wondeStudents,
    staffCount: s._count.wondeEmployees,
    activeFlags: s.featureFlags.map(f => f.flag),
  }))
}

export async function createSchool(data: {
  name: string
  urn: string
  phase: string
  localAuthority?: string
  region?: string
}): Promise<void> {
  const user = await requirePlatformAdmin()
  const school = await prisma.school.create({
    data: {
      name: data.name,
      urn: data.urn || null,
      phase: data.phase,
      localAuthority: data.localAuthority || null,
      region: data.region || null,
      isActive: true,
      onboardedAt: new Date(),
    },
  })
  await prisma.platformAuditLog.create({
    data: {
      actorId: user.id,
      action: 'school.created',
      target: school.id,
      metadata: { name: data.name, urn: data.urn },
    },
  })
  revalidatePath('/platform-admin/schools')
}

export async function toggleSchoolActive(schoolId: string): Promise<void> {
  const user = await requirePlatformAdmin()
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } })
  const newActive = !school.isActive
  await prisma.school.update({ where: { id: schoolId }, data: { isActive: newActive } })
  await prisma.platformAuditLog.create({
    data: {
      actorId: user.id,
      action: newActive ? 'school.activated' : 'school.deactivated',
      target: schoolId,
      metadata: { name: school.name },
    },
  })
  revalidatePath('/platform-admin/schools')
}

// ─── Feature flags ────────────────────────────────────────────────────────────

export async function getFeatureFlags(schoolId: string): Promise<FeatureFlagRow[]> {
  await requirePlatformAdmin()
  return prisma.schoolFeatureFlag.findMany({
    where: { schoolId },
    orderBy: { flag: 'asc' },
  })
}

export async function setFeatureFlag(
  schoolId: string,
  flag: string,
  enabled: boolean,
): Promise<void> {
  const user = await requirePlatformAdmin()
  await prisma.schoolFeatureFlag.upsert({
    where: { schoolId_flag: { schoolId, flag } },
    create: { schoolId, flag, enabled, setBy: user.id },
    update: { enabled, setAt: new Date(), setBy: user.id },
  })
  await prisma.platformAuditLog.create({
    data: {
      actorId: user.id,
      action: 'flag.toggled',
      target: schoolId,
      metadata: { flag, enabled },
    },
  })
  revalidatePath('/platform-admin/schools')
}

// ─── Audit log ────────────────────────────────────────────────────────────────

export async function getAuditLog(limit = 50): Promise<AuditLogRow[]> {
  await requirePlatformAdmin()
  const logs = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  // Join actor names
  const actorIds = [...new Set(logs.map(l => l.actorId))]
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const actorMap = new Map(actors.map(a => [a.id, `${a.firstName} ${a.lastName}`]))

  return logs.map(l => ({
    id: l.id,
    actorId: l.actorId,
    actorName: actorMap.get(l.actorId) ?? l.actorId,
    action: l.action,
    target: l.target,
    metadata: l.metadata,
    createdAt: l.createdAt,
  }))
}

// ─── Usage chart data ─────────────────────────────────────────────────────────

function isoWeekLabel(date: Date): string {
  // Get ISO week number
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `W${week} ${tmp.getUTCFullYear()}`
}

function isoWeekSort(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export async function getPlatformUsageStats(): Promise<WeeklyUsageStat[]> {
  await requirePlatformAdmin()

  const since = new Date()
  since.setDate(since.getDate() - 56) // 8 weeks back

  const [resources, sendScores, consentRecords] = await Promise.all([
    prisma.resource.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.sendQualityScore.findMany({
      where: { scoredAt: { gte: since } },
      select: { scoredAt: true },
    }),
    prisma.consentRecord.findMany({
      where: { recordedAt: { gte: since } },
      select: { recordedAt: true },
    }),
  ])

  // Build week map
  const weekMap = new Map<string, WeeklyUsageStat>()

  // Seed all 8 weeks so we always show 8 bars even if empty
  for (let w = 0; w < 8; w++) {
    const d = new Date()
    d.setDate(d.getDate() - w * 7)
    const label = isoWeekLabel(d)
    const iso   = isoWeekSort(d)
    if (!weekMap.has(iso)) {
      weekMap.set(iso, { week: label, isoWeek: iso, oakAdditions: 0, sendScores: 0, consentRecords: 0 })
    }
  }

  for (const r of resources) {
    const iso = isoWeekSort(r.createdAt)
    const entry = weekMap.get(iso)
    if (entry) entry.oakAdditions++
  }
  for (const s of sendScores) {
    const iso = isoWeekSort(s.scoredAt)
    const entry = weekMap.get(iso)
    if (entry) entry.sendScores++
  }
  for (const c of consentRecords) {
    const iso = isoWeekSort(c.recordedAt)
    const entry = weekMap.get(iso)
    if (entry) entry.consentRecords++
  }

  return [...weekMap.values()].sort((a, b) => a.isoWeek.localeCompare(b.isoWeek))
}
