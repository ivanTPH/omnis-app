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

  // Fetch per-class KPIs in parallel
  const [enrolmentRows, kpiRows] = await Promise.all([
    // Student count per class
    prisma.enrolment.groupBy({
      by:    ['classId'],
      where: { classId: { in: classIds } },
      _count: { classId: true },
    }),
    // Per-class SEND + needs-marking counts (parallel per class)
    Promise.all(
      classIds.map(async (id: string) => {
        const [sendCount, needsMarking] = await Promise.all([
          prisma.sendStatus.count({
            where: {
              activeStatus: { not: 'NONE' },
              student: { enrolments: { some: { classId: id } } },
            },
          }),
          prisma.submission.count({
            where: {
              status:   'SUBMITTED',
              homework: { classId: id },
            },
          }),
        ])
        return { classId: id, sendCount, needsMarking }
      })
    ),
  ])

  // Per-class student count
  const studentCount: Record<string, number> = {}
  for (const r of enrolmentRows) {
    if (r.classId) studentCount[r.classId] = r._count.classId
  }

  const sendCount: Record<string, number>    = {}
  const needsMarking: Record<string, number> = {}
  for (const r of kpiRows) {
    sendCount[r.classId]    = r.sendCount
    needsMarking[r.classId] = r.needsMarking
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
