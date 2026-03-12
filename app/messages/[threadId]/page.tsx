import { auth }         from '@/lib/auth'
import { redirect }     from 'next/navigation'
import AppShell         from '@/components/AppShell'
import { prisma }       from '@/lib/prisma'
import { getMyThreads } from '@/app/actions/messaging'
import MessagingShell   from '@/components/messaging/MessagingShell'

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as any
  const { threadId } = await params

  // Verify participant
  const participation = await prisma.msgParticipant.findUnique({
    where: { threadId_userId: { threadId, userId: user.id } },
  })
  if (!participation) redirect('/messages')

  const threads = await getMyThreads()

  return (
    <AppShell
      role={user.role}
      firstName={user.firstName}
      lastName={user.lastName}
      schoolName={user.schoolName}
    >
      <div className="h-full flex flex-col min-h-0">
        <MessagingShell
          initialThreads={threads}
          initialThreadId={threadId}
          currentUserId={user.id}
        />
      </div>
    </AppShell>
  )
}
