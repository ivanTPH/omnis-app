import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAllConcerns } from '@/app/actions/send-support'
import ConcernsPageView from '@/components/send-support/ConcernsPageView'

export default async function ConcernsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as { role: string }
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) redirect('/dashboard')

  const concerns = await getAllConcerns()

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900">SEND Concerns</h1>
        <p className="text-sm text-gray-500 mt-0.5">All concerns raised across the school</p>
      </div>
      <div className="p-6">
        <ConcernsPageView initialConcerns={concerns} />
      </div>
    </div>
  )
}
