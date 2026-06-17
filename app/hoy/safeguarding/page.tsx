import { redirect }              from 'next/navigation'
import { requireAuth }           from '@/lib/session'
import { getSafeguardingLog }    from '@/app/actions/safeguarding'
import SafeguardingView          from './SafeguardingView'

const ALLOWED = ['HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'SENCO']

export default async function SafeguardingPage() {
  const user = await requireAuth()
  if (!ALLOWED.includes(user.role)) redirect('/dashboard')

  const log = await getSafeguardingLog()

  return <SafeguardingView log={log} />
}
