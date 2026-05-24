import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import Icon from '@/components/ui/Icon'

export default async function LessonsPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-6">
            <Icon name="construction" size="lg" className="text-blue-700" />
          </div>
          <h1 className="text-page-title mb-2">Lessons</h1>
          <p className="text-gray-500 mb-1">Browse all lessons — coming soon.</p>
          <p className="text-sm text-gray-400">Manage lessons from the Calendar view on the dashboard.</p>
        </div>
      </div>
    </AppShell>
  )
}
