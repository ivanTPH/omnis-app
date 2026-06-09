'use server'

import { requireAuth } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export type SearchResultType = 'student' | 'staff' | 'homework' | 'resource'

export type SearchResult = {
  type:     SearchResultType
  id:       string
  title:    string
  subtitle: string
  href:     string
}

const ROLE_LABEL: Record<string, string> = {
  TEACHER:            'Teacher',
  HEAD_OF_DEPT:       'Head of Dept',
  HEAD_OF_YEAR:       'Head of Year',
  SENCO:              'SENCO',
  SLT:                'SLT',
  SCHOOL_ADMIN:       'School Admin',
  TEACHING_ASSISTANT: 'Teaching Assistant',
  COVER_MANAGER:      'Cover Manager',
  ACADEMY_ADMIN:      'Academy Admin',
  PLATFORM_ADMIN:     'Platform Admin',
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const { schoolId, role } = await requireAuth()
  const q = query.trim()
  if (q.length < 2) return []
  if (role === 'STUDENT' || role === 'PARENT') return []

  const [students, staff, homework, resources] = await Promise.all([
    prisma.user.findMany({
      where: {
        schoolId,
        role: 'STUDENT',
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName:  { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, yearGroup: true },
      take: 6,
    }),
    prisma.user.findMany({
      where: {
        schoolId,
        role: { notIn: ['STUDENT', 'PARENT'] },
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName:  { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, role: true },
      take: 4,
    }),
    prisma.homework.findMany({
      where: {
        schoolId,
        title: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, title: true, status: true, class: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.resource.findMany({
      where: {
        schoolId,
        label: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, label: true, type: true },
      take: 4,
    }),
  ])

  const results: SearchResult[] = []

  for (const s of students) {
    results.push({
      type:     'student',
      id:       s.id,
      title:    `${s.firstName} ${s.lastName}`,
      subtitle: s.yearGroup ? `Year ${s.yearGroup}` : 'Student',
      href:     `/students/${s.id}`,
    })
  }

  for (const s of staff) {
    results.push({
      type:     'staff',
      id:       s.id,
      title:    `${s.firstName} ${s.lastName}`,
      subtitle: ROLE_LABEL[s.role] ?? s.role,
      href:     `/admin/users`,
    })
  }

  for (const hw of homework) {
    results.push({
      type:     'homework',
      id:       hw.id,
      title:    hw.title,
      subtitle: hw.class?.name ?? hw.status,
      href:     `/homework/${hw.id}`,
    })
  }

  for (const r of resources) {
    results.push({
      type:     'resource',
      id:       r.id,
      title:    r.label,
      subtitle: r.type,
      href:     `/resources`,
    })
  }

  return results
}
