import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import AppShell from '@/components/AppShell'
import RevisionProgramDetail from '@/components/revision-program/RevisionProgramDetail'
import { getRevisionProgramDetail } from '@/app/actions/revision-program'
import { prisma } from '@/lib/prisma'

export default async function RevisionProgramDetailPage({ params }: { params: Promise<{ programId: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName, schoolId } = session.user as any

  const { programId } = await params
  const detail = await getRevisionProgramDetail(programId)
  if (!detail) notFound()

  // Fetch student info for all task owners
  const studentIds = [...new Set(detail.tasks.map((t: any) => t.studentId))]
  const students = studentIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: studentIds as string[] }, schoolId },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      })
    : []
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <RevisionProgramDetail
          program={detail.program}
          tasks={detail.tasks}
          completionStats={detail.completionStats}
          studentMap={studentMap}
        />
      </div>
    </AppShell>
  )
}
