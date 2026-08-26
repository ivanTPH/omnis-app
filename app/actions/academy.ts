'use server'

import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

async function requireAcademy() {
  const u = await requireAuth()
  if (!['ACADEMY_ADMIN', 'PLATFORM_ADMIN'].includes(u.role)) redirect('/dashboard')

  // ACADEMY_ADMIN must be scoped to their own Multi-Academy Trust so one trust
  // can never see another trust's (or a standalone school's) SEND/EHCP/
  // safeguarding data. PLATFORM_ADMIN is the only genuinely cross-platform role.
  let schoolGroupId: string | null = null
  if (u.role === 'ACADEMY_ADMIN') {
    const school = await prisma.school.findUnique({ where: { id: u.schoolId }, select: { schoolGroupId: true } })
    schoolGroupId = school?.schoolGroupId ?? null
  }
  return { ...u, schoolGroupId }
}

/** Prisma `School` where-clause scoping an academy user to their own trust
 * (or, if they aren't in a trust, to just their own school) — never to the
 * whole platform unless they're PLATFORM_ADMIN. */
function academyScopeWhere(u: { role: string; schoolId: string; schoolGroupId: string | null }) {
  if (u.role === 'PLATFORM_ADMIN') return { isActive: true }
  return u.schoolGroupId
    ? { isActive: true, schoolGroupId: u.schoolGroupId }
    : { isActive: true, id: u.schoolId }
}

export type AcademyStats = {
  totalSchools:       number
  totalStudents:      number
  totalStaff:         number
  onboardedSchools:   number   // how many have completed setup
  totalActiveIlps:    number
  totalEhcps:         number
  openConcerns:       number   // open/escalated SEND concerns across trust
}

export type AcademySchoolRow = {
  id:            string
  name:          string
  phase:         string | null
  studentCount:  number
  staffCount:    number
  onboardedAt:   Date | null
  isActive:      boolean
  lastSync:      Date | null
  activeIlps:    number
  ehcps:         number
  openConcerns:  number
  sendStudents:  number        // students on SEND register
}

export async function getAcademyStats(): Promise<AcademyStats> {
  const u = await requireAcademy()
  const scopeWhere = academyScopeWhere(u)
  const scopedSchools = await prisma.school.findMany({ where: scopeWhere, select: { id: true } })
  const schoolIds = scopedSchools.map(s => s.id)

  const [totalSchools, totalStudents, totalStaff, onboardedSchools, totalActiveIlps, totalEhcps, openConcerns] =
    await Promise.all([
      prisma.school.count({ where: scopeWhere }),
      prisma.user.count({ where: { schoolId: { in: schoolIds }, role: 'STUDENT', isActive: true } }),
      prisma.user.count({ where: { schoolId: { in: schoolIds }, role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true } }),
      prisma.school.count({ where: { ...scopeWhere, onboardedAt: { not: null } } }),
      prisma.individualLearningPlan.count({ where: { schoolId: { in: schoolIds }, status: 'active' } }),
      prisma.ehcpPlan.count({ where: { schoolId: { in: schoolIds }, status: { in: ['active', 'under_review'] } } }),
      prisma.sendConcern.count({ where: { schoolId: { in: schoolIds }, status: { in: ['open', 'under_review', 'escalated'] } } }),
    ])

  return { totalSchools, totalStudents, totalStaff, onboardedSchools, totalActiveIlps, totalEhcps, openConcerns }
}

export async function getAcademySchools(): Promise<AcademySchoolRow[]> {
  const u = await requireAcademy()

  const schools = await prisma.school.findMany({
    where: academyScopeWhere(u),
    include: {
      _count: {
        select: {
          users:        { where: { role: 'STUDENT', isActive: true } },
          sendConcerns: { where: { status: { in: ['open', 'under_review', 'escalated'] } } },
        },
      },
      wondeSyncLogs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { startedAt: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const [staffCounts, ilpCounts, ehcpCounts, sendStudentCounts] = await Promise.all([
    Promise.all(schools.map(s =>
      prisma.user.count({ where: { schoolId: s.id, role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true } })
    )),
    Promise.all(schools.map(s =>
      prisma.individualLearningPlan.count({ where: { schoolId: s.id, status: 'active' } })
    )),
    Promise.all(schools.map(s =>
      prisma.ehcpPlan.count({ where: { schoolId: s.id, status: { in: ['active', 'under_review'] } } })
    )),
    Promise.all(schools.map(s =>
      prisma.sendStatus.count({ where: { student: { schoolId: s.id }, NOT: { activeStatus: 'NONE' } } })
    )),
  ])

  return schools.map((s, i) => ({
    id:           s.id,
    name:         s.name,
    phase:        s.phase,
    studentCount: s._count.users,
    staffCount:   staffCounts[i],
    onboardedAt:  s.onboardedAt,
    isActive:     s.isActive,
    lastSync:     s.wondeSyncLogs[0]?.startedAt ?? null,
    activeIlps:   ilpCounts[i],
    ehcps:        ehcpCounts[i],
    openConcerns: s._count.sendConcerns,
    sendStudents: sendStudentCounts[i],
  }))
}
