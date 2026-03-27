import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEarlyWarningFlags } from '@/app/actions/send-support'
import { getIlpConcernsThisTerm } from '@/app/actions/homework'
import EarlyWarningPanel from '@/components/send-support/EarlyWarningPanel'
import { AlertTriangle } from 'lucide-react'

export default async function EarlyWarningPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const user = session.user as { role: string }
  if (!['SENCO', 'SLT', 'SCHOOL_ADMIN'].includes(user.role)) redirect('/dashboard')

  const [flags, ilpConcerns] = await Promise.all([
    getEarlyWarningFlags(),
    getIlpConcernsThisTerm(),
  ])

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-semibold text-gray-900">Early Warning System</h1>
        <p className="text-sm text-gray-500 mt-0.5">AI-detected patterns in student performance — review and action</p>
      </div>
      {ilpConcerns.length > 0 && (
        <div className="px-6 pb-2 pt-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-rose-600" />
              <p className="text-[13px] font-bold text-rose-800">ILP Concern Alert</p>
              <span className="ml-auto text-[11px] text-rose-600 font-medium">{ilpConcerns.length} student{ilpConcerns.length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-[11px] text-rose-700 mb-3">The following students have 3 or more CONCERN entries in their ILP evidence this term:</p>
            <div className="space-y-1.5">
              {ilpConcerns.map((s: any) => (
                <div key={s.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-rose-600">{s.firstName[0]}{s.lastName[0]}</span>
                  </div>
                  <a href={`/send/ilp/${s.id}`} className="text-[12px] font-medium text-rose-800 hover:underline">
                    {s.firstName} {s.lastName}
                  </a>
                  {s.yearGroup && <span className="text-[11px] text-rose-500">Y{s.yearGroup}</span>}
                  <span className="ml-auto text-[11px] font-bold text-rose-700">{s.concernCount}× CONCERN</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="p-6">
        <EarlyWarningPanel flags={flags} />
      </div>
    </div>
  )
}
