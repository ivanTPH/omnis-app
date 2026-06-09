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
  totalSchools:   number
  totalStudents:  number
  totalStaff:     number
  totalHomework:  number
  totalActiveIlps: number
  totalEhcps:     number
}

export type AcademySchoolRow = {
  id:           string
  name:         string
  phase:        string | null
  studentCount: number
  staffCount:   number
  classCount:   number
  onboardedAt:  Date | null
  isActive:     boolean
  lastSync:     Date | null
}

export async function getAcademyStats(): Promise<AcademyStats> {
  await requireAcademy()

  const [totalSchools, totalStudents, totalStaff, totalHomework, totalActiveIlps, totalEhcps] =
    await Promise.all([
      prisma.school.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.user.count({ where: { role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true } }),
      prisma.homework.count({ where: { status: 'PUBLISHED' } }),
      prisma.iLP.count({ where: { status: 'ACTIVE' } }),
      prisma.ehcpPlan.count(),
    ])

  return { totalSchools, totalStudents, totalStaff, totalHomework, totalActiveIlps, totalEhcps }
}

export async function getAcademySchools(): Promise<AcademySchoolRow[]> {
  await requireAcademy()

  const schools = await prisma.school.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          users:   { where: { role: 'STUDENT', isActive: true } },
          classes: true,
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

  const staffCounts = await Promise.all(
    schools.map(s =>
      prisma.user.count({
        where: { schoolId: s.id, role: { notIn: ['STUDENT', 'PARENT'] }, isActive: true },
      })
    )
  )

  return schools.map((s, i) => ({
    id:           s.id,
    name:         s.name,
    phase:        s.phase,
    studentCount: s._count.users,
    staffCount:   staffCounts[i],
    classCount:   s._count.classes,
    onboardedAt:  s.onboardedAt,
    isActive:     s.isActive,
    lastSync:     s.wondeSyncLogs[0]?.startedAt ?? null,
  }))
}
