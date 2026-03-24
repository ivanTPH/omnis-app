import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import PlansView from '@/components/PlansView'
import { prisma } from '@/lib/prisma'

const SENCO_TIER = ['SENCO', 'SLT', 'SCHOOL_ADMIN']
const ALLOWED    = [...SENCO_TIER, 'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR']

async function getStudentIdsForUser(schoolId: string, userId: string, role: string): Promise<string[]> {
  if (SENCO_TIER.includes(role)) {
    // SENCO/SLT see all students in the school
    const students = await prisma.user.findMany({
      where:  { schoolId, role: 'STUDENT' },
      select: { id: true },
    })
    return students.map(s => s.id)
  }
  // Teachers/HOD/HOY see only students in their classes
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

async function getSendPlans(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) return { ilps: [], ehcps: [] }

  const [ilps, ehcps] = await Promise.all([
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
  ])

  return { ilps, ehcps }
}

export default async function PlansPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { id: userId, role, firstName, lastName, schoolName, schoolId } = session.user as {
    id: string; role: string; firstName: string; lastName: string; schoolName: string; schoolId: string
  }

  if (!ALLOWED.includes(role)) redirect('/dashboard')

  let ilps:  Awaited<ReturnType<typeof getSendPlans>>['ilps']  = []
  let ehcps: Awaited<ReturnType<typeof getSendPlans>>['ehcps'] = []
  try {
    const studentIds = await getStudentIdsForUser(schoolId, userId, role)
    const result     = await getSendPlans(schoolId, studentIds)
    ilps  = result.ilps
    ehcps = result.ehcps
  } catch (err) {
    console.error('[PlansPage] fetch failed:', err)
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <PlansView ilps={ilps} ehcps={ehcps} role={role} />
    </AppShell>
  )
}
