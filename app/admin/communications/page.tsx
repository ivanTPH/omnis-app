import { redirect }              from 'next/navigation'
import { requireAuth }           from '@/lib/session'
import { getCommunicationLog }   from '@/app/actions/communications'
import CommunicationsView        from './CommunicationsView'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO', 'HEAD_OF_DEPT']

export default async function AdminCommunicationsPage() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) redirect('/dashboard')

  const log = await getCommunicationLog()

  return <CommunicationsView log={log} />
}
