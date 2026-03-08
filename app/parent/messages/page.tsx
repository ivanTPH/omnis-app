import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import ParentMessagesView from '@/components/ParentMessagesView'

export default async function ParentMessagesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const { schoolId, role, id: userId, firstName, lastName, schoolName } = session.user as any
  if (role !== 'PARENT') redirect('/dashboard')

  const conversations = await prisma.parentConversation.findMany({
    where: { schoolId, parentId: userId },
    include: {
      teacher:        { select: { id: true, firstName: true, lastName: true } },
      parentMessages: { orderBy: { sentAt: 'asc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: userId },
    include: { child: { select: { id: true, firstName: true, lastName: true } } },
  })
  const children = links.map(l => l.child)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex-1 min-h-0 overflow-hidden">
        <ParentMessagesView
          conversations={conversations as any}
          linkedChildren={children}
        />
      </div>
    </AppShell>
  )
}
