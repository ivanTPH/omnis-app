import { requireAuth } from '@/lib/session'
import AppShell          from '@/components/AppShell'
import { getMyThreads }  from '@/app/actions/messaging'
import MessagingShell    from '@/components/messaging/MessagingShell'

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string }>
}) {
  const user = await requireAuth()
  const { threadId } = await searchParams

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
          initialThreadId={threadId ?? null}
          currentUserId={user.id}
        />
      </div>
    </AppShell>
  )
}
