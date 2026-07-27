import { requireAuth }    from '@/lib/session'
import AppShell           from '@/components/AppShell'
import BulkReviewClient   from './BulkReviewClient'

export const metadata = { title: 'Bulk Target Review — Omnis' }

export default async function SencoBulkReviewPage() {
  const user = await requireAuth('SENCO')
  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <BulkReviewClient />
    </AppShell>
  )
}
