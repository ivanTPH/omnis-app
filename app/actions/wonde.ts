'use server'
import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { type WondeSyncResult } from '@/lib/wonde-sync'
import { resolveWondeTarget, runLoggedWondeSync } from '@/lib/wonde-sync-runner'
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
  const { schoolId, role } = await requireAuth()
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
  const { role } = await requireAuth()
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
  const { schoolId, role } = await requireAuth()
  requireAdminOrSlt(role)

  // Only the school linked to the configured Wonde school may sync it —
  // see lib/wonde-sync-runner.ts for why.
  const target = await resolveWondeTarget(schoolId)
  if (!target.ok) return { success: false, error: target.error }

  const run = await runLoggedWondeSync(target, 'full')
  if (!run.error) revalidatePath('/admin/wonde')
  return run
}

// ── Sync logs ─────────────────────────────────────────────────────────────────

export async function getWondeSyncLogs(limit = 20) {
  const { schoolId, role } = await requireAuth()
  requireAdminOrSlt(role)

  return prisma.wondeSyncLog.findMany({
    where:   { schoolId },
    orderBy: { startedAt: 'desc' },
    take:    limit,
  })
}

// ── Wonde data counts ─────────────────────────────────────────────────────────

export async function getWondeCounts() {
  const { schoolId, role } = await requireAuth()
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
