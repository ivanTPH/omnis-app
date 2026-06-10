'use server'

import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

async function requireAcademy() {
  const u = await requireAuth()
  if (!['ACADEMY_ADMIN', 'PLATFORM_ADMIN'].includes(u.role)) redirect('/dashboard')
  return u
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
  await requireAcademy()

  const [totalSchools, totalStudents, totalStaff, onboardedSchools, totalActiveIlps, totalEhcps, openConcerns] =
    await Promise.all([
      prisma.school.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.user.count({ where: { role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true } }),
      prisma.school.count({ where: { isActive: true, onboardedAt: { not: null } } }),
      prisma.iLP.count({ where: { status: 'ACTIVE' } }),
      prisma.ehcpPlan.count({ where: { status: { in: ['ACTIVE', 'UNDER_REVIEW'] } } }),
      prisma.sendConcern.count({ where: { status: { in: ['open', 'under_review', 'escalated'] } } }),
    ])

  return { totalSchools, totalStudents, totalStaff, onboardedSchools, totalActiveIlps, totalEhcps, openConcerns }
}

export async function getAcademySchools(): Promise<AcademySchoolRow[]> {
  await requireAcademy()

  const schools = await prisma.school.findMany({
    where: { isActive: true },
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
      prisma.iLP.count({ where: { schoolId: s.id, status: 'ACTIVE' } })
    )),
    Promise.all(schools.map(s =>
      prisma.ehcpPlan.count({ where: { schoolId: s.id, status: { in: ['ACTIVE', 'UNDER_REVIEW'] } } })
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
