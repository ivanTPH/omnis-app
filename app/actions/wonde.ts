'use server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runWondeSync, type WondeSyncResult } from '@/lib/wonde-sync'
import { fetchWondeSchool } from '@/lib/wonde-client'
import { revalidatePath } from 'next/cache'

function requireAdminOrSlt(role: string) {
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) throw new Error('Unauthorised')
}

// ── Get Wonde config for the school ──────────────────────────────────────────

export async function getWondeConfig(): Promise<{
  connected: boolean
  wondeSchoolId: string | null
  mis: string | null
  phase: string | null
  syncedAt: Date | null
  lastDeltaAt: Date | null
} | null> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, role } = session.user as any
  requireAdminOrSlt(role)

  const wondeEnvId = process.env.WONDE_SCHOOL_ID ?? null

  if (!wondeEnvId) {
    return { connected: false, wondeSchoolId: null, mis: null, phase: null, syncedAt: null, lastDeltaAt: null }
  }

  const record = await prisma.wondeSchool.findUnique({ where: { schoolId } })
  return {
    connected:    !!record,
    wondeSchoolId: wondeEnvId,
    mis:           record?.mis ?? null,
    phase:         record?.phaseOfEducation ?? null,
    syncedAt:      record?.syncedAt ?? null,
    lastDeltaAt:   record?.lastDeltaAt ?? null,
  }
}

// ── Test API connection ───────────────────────────────────────────────────────

export async function testWondeConnection(): Promise<{
  ok: boolean
  schoolName?: string
  mis?: string
  error?: string
}> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { role } = session.user as any
  requireAdminOrSlt(role)

  const token    = process.env.WONDE_API_TOKEN
  const schoolId = process.env.WONDE_SCHOOL_ID

  if (!token || !schoolId) {
    return { ok: false, error: 'WONDE_API_TOKEN or WONDE_SCHOOL_ID not configured' }
  }

  try {
    const school = await fetchWondeSchool(schoolId, token)
    return {
      ok:         true,
      schoolName: school.name,
      mis:        school.mis_provider?.name ?? 'Unknown MIS',
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ── Run full sync ─────────────────────────────────────────────────────────────

export async function triggerWondeSync(): Promise<{
  success: boolean
  result?: WondeSyncResult
  logId?: string
  error?: string
}> {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, role } = session.user as any
  requireAdminOrSlt(role)

  const token       = process.env.WONDE_API_TOKEN
  const wondeSchId  = process.env.WONDE_SCHOOL_ID

  if (!token || !wondeSchId) {
    return { success: false, error: 'Wonde credentials not configured' }
  }

  // Create sync log entry (in-progress)
  const log = await prisma.wondeSyncLog.create({
    data: {
      schoolId,
      syncType: 'full',
      status:   'running',
      startedAt: new Date(),
    },
  })

  try {
    const result = await runWondeSync(schoolId, wondeSchId, token)

    const totalRecords =
      result.employees.upserted +
      result.students.upserted +
      result.contacts.upserted +
      result.groups.upserted +
      result.classes.upserted +
      result.enrolments.upserted +
      result.periods.upserted +
      result.timetable.upserted

    await prisma.wondeSyncLog.update({
      where: { id: log.id },
      data: {
        status:           result.errors.length > 0 ? 'partial' : 'success',
        recordsProcessed: totalRecords,
        errors:           result.errors,
        completedAt:      new Date(),
      },
    })

    revalidatePath('/admin/wonde')
    return { success: true, result, logId: log.id }
  } catch (err) {
    await prisma.wondeSyncLog.update({
      where: { id: log.id },
      data: {
        status:      'failed',
        errors:      [String(err)],
        completedAt: new Date(),
      },
    })
    return { success: false, error: String(err), logId: log.id }
  }
}

// ── Sync logs ─────────────────────────────────────────────────────────────────

export async function getWondeSyncLogs(limit = 20) {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, role } = session.user as any
  requireAdminOrSlt(role)

  return prisma.wondeSyncLog.findMany({
    where:   { schoolId },
    orderBy: { startedAt: 'desc' },
    take:    limit,
  })
}

// ── Wonde data counts ─────────────────────────────────────────────────────────

export async function getWondeCounts() {
  const session = await auth()
  if (!session) throw new Error('Unauthenticated')
  const { schoolId, role } = session.user as any
  requireAdminOrSlt(role)

  const [employees, students, classes, groups, periods, timetable] = await Promise.all([
    prisma.wondeEmployee.count({ where: { schoolId } }),
    prisma.wondeStudent.count({ where: { schoolId } }),
    prisma.wondeClass.count({ where: { schoolId } }),
    prisma.wondeGroup.count({ where: { schoolId } }),
    prisma.wondePeriod.count({ where: { schoolId } }),
    prisma.wondeTimetableEntry.count({ where: { schoolId } }),
  ])

  return { employees, students, classes, groups, periods, timetable }
}
