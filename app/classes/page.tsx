import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import MyClassesView, { type ClassKpis } from '@/components/MyClassesView'
import { PageHeader } from '@/components/ui/PageHeader'
import { getTeacherDefaults } from '@/app/actions/analytics'

export default async function ClassesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const { role, firstName, lastName, schoolName, schoolId } = session.user as any
  const { teacherClasses } = await getTeacherDefaults()

  const classIds = teacherClasses.map((c: { id: string }) => c.id)

  // Fetch all KPI data in 4 batch queries (no N+1)
  const [enrolmentCounts, allEnrolments, homeworkRows, sendStatuses] = await Promise.all([
    // 1. Student count per class
    prisma.enrolment.groupBy({
      by:    ['classId'],
      where: { classId: { in: classIds } },
      _count: { classId: true },
    }),
    // 2. All userId→classId mappings for these classes (for SEND join)
    prisma.enrolment.findMany({
      where:  { classId: { in: classIds } },
      select: { classId: true, userId: true },
    }),
    // 3. All homeworks for these classes
    prisma.homework.findMany({
      where:  { classId: { in: classIds } },
      select: { id: true, classId: true },
    }),
    // 4. All SEND students in this school
    prisma.sendStatus.findMany({
      where:  { activeStatus: { not: 'NONE' }, student: { schoolId } },
      select: { studentId: true },
    }),
  ])

  // 5. Batch submitted submission counts by homework ID
  const homeworkIds = homeworkRows.map((h: { id: string }) => h.id)
  const submissionCounts = homeworkIds.length > 0
    ? await prisma.submission.groupBy({
        by:    ['homeworkId'],
        where: { homeworkId: { in: homeworkIds }, status: 'SUBMITTED' },
        _count: { homeworkId: true },
      })
    : []

  // Aggregate in JS
  const studentCount: Record<string, number> = {}
  for (const r of enrolmentCounts) {
    if (r.classId) studentCount[r.classId] = r._count.classId
  }

  const sendUserIds = new Set(sendStatuses.map((s: { studentId: string }) => s.studentId))
  const sendCount: Record<string, number> = {}
  for (const r of allEnrolments) {
    if (r.classId && sendUserIds.has(r.userId)) {
      sendCount[r.classId] = (sendCount[r.classId] ?? 0) + 1
    }
  }

  // Map homeworkId → classId
  const hwClassMap: Record<string, string> = {}
  for (const h of homeworkRows) {
    if (h.classId) hwClassMap[h.id] = h.classId
  }

  const needsMarking: Record<string, number> = {}
  for (const r of submissionCounts) {
    const cid = hwClassMap[r.homeworkId]
    if (cid) needsMarking[cid] = (needsMarking[cid] ?? 0) + r._count.homeworkId
  }

  const kpiData: Record<string, ClassKpis> = {}
  for (const id of classIds) {
    kpiData[id] = {
      students:     studentCount[id]  ?? 0,
      sendCount:    sendCount[id]     ?? 0,
      needsMarking: needsMarking[id]  ?? 0,
    }
  }

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-4xl mx-auto">
        <PageHeader
          title="My Classes"
          subtitle={`${teacherClasses.length} class${teacherClasses.length !== 1 ? 'es' : ''} this term`}
        />
        <MyClassesView classes={teacherClasses} role={role} kpiData={kpiData} />
      </div>
    </AppShell>
  )
}
