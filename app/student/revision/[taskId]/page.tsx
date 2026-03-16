import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import RevisionTaskView from '@/components/revision-program/RevisionTaskView'
import { prisma } from '@/lib/prisma'

export default async function StudentRevisionTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const { role, firstName, lastName, schoolName, id: userId, schoolId } = session.user as any
  if (role !== 'STUDENT') redirect('/dashboard')

  const { taskId } = await params

  const task = await (prisma as any).revisionTask.findFirst({
    where: { id: taskId, studentId: userId, schoolId },
    include: { program: { select: { title: true, subject: true, mode: true, deadline: true } } },
  })
  if (!task) redirect('/student/revision')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-3 border-b bg-white flex items-center gap-3">
          <a href="/student/revision" className="text-gray-400 hover:text-gray-600 text-sm">← Back</a>
          <h1 className="text-sm font-semibold text-gray-900 truncate">{task.program.title}</h1>
          <span className="text-xs text-blue-700 font-medium shrink-0">{task.program.subject}</span>
        </div>
        <RevisionTaskView task={task as any} />
      </div>
    </AppShell>
  )
}
