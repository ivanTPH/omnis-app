import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEarlyWarningFlags } from '@/app/actions/send-support'
import EarlyWarningPanel from '@/components/send-support/EarlyWarningPanel'

export default async function EarlyWarningPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as { role: string }
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) redirect('/dashboard')

  const flags = await getEarlyWarningFlags()

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900">Early Warning System</h1>
        <p className="text-sm text-gray-500 mt-0.5">AI-detected patterns in student performance — review and action</p>
      </div>
      <div className="p-6">
        <EarlyWarningPanel flags={flags} />
      </div>
    </div>
  )
}
