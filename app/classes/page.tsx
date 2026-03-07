import { auth }     from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma }   from '@/lib/prisma'
import AppShell     from '@/components/AppShell'
import ClassListView from '@/components/ClassListView'

export const dynamic = 'force-dynamic'

export default async function ClassesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any

  const isTeacher = role === 'TEACHER' || role === 'COVER_MANAGER'

  const rawClasses = await prisma.schoolClass.findMany({
    where: {
      schoolId,
      ...(isTeacher ? { teachers: { some: { userId } } } : {}),
    },
    include: {
      enrolments: {
        include: {
          user: {
            select: {
              id:         true,
              firstName:  true,
              lastName:   true,
              yearGroup:  true,
              sendStatus: { select: { activeStatus: true, needArea: true } },
            },
          },
        },
      },
    },
    orderBy: [{ yearGroup: 'asc' }, { name: 'asc' }],
  })

  const classes = rawClasses.map(c => ({
    id:         c.id,
    name:       c.name,
    subject:    c.subject,
    yearGroup:  c.yearGroup,
    department: c.department,
    students: c.enrolments.map(e => ({
      id:         e.user.id,
      firstName:  e.user.firstName,
      lastName:   e.user.lastName,
      yearGroup:  e.user.yearGroup,
      sendStatus: e.user.sendStatus?.activeStatus ?? 'NONE',
      needArea:   e.user.sendStatus?.needArea ?? null,
    })).sort((a, b) => a.lastName.localeCompare(b.lastName)),
  }))

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto">
        <ClassListView classes={classes} />
      </main>
    </AppShell>
  )
}
