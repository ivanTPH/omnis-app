import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { getTimetable } from '@/app/actions/admin'
import AdminTimetableGrid from '@/components/admin/AdminTimetableGrid'
import TimetableSyncButton from '@/components/admin/TimetableSyncButton'

export default async function AdminTimetablePage() {
  const { schoolId, role, firstName, lastName, schoolName } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const entries = await getTimetable(schoolId)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-8 sm:py-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-gray-900">School Timetable</h1>
              <p className="text-[13px] text-gray-400 mt-0.5">
                {entries.length} scheduled entries (imported from MIS)
              </p>
            </div>
            <TimetableSyncButton />
          </div>
          <AdminTimetableGrid entries={entries} />
        </div>
      </main>
    </AppShell>
  )
}
