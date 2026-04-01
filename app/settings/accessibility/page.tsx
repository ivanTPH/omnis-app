import { redirect }               from 'next/navigation'
import { auth }                    from '@/lib/auth'
import { getAccessibilitySettings } from '@/app/actions/accessibility'
import AccessibilitySettingsView   from '@/components/accessibility/AccessibilitySettingsView'
import AppShell                    from '@/components/AppShell'
import Link                        from 'next/link'
import Icon                        from '@/components/ui/Icon'

export default async function AccessibilitySettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  const settings = await getAccessibilitySettings(user.id)

  return (
    <AppShell role={user.role} firstName={user.firstName} lastName={user.lastName} schoolName={user.schoolName}>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 mb-4 transition-colors">
            <Icon name="arrow_back" size="sm" />
            Settings
          </Link>
          <h1 className="text-[20px] font-bold text-gray-900">Accessibility</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Personalise your experience. Settings are saved to your account and apply on every device.
          </p>
        </div>
        <AccessibilitySettingsView initialSettings={settings} userId={user.id} />
      </div>
    </AppShell>
  )
}
