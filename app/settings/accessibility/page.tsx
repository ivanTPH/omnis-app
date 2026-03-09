import { redirect }               from 'next/navigation'
import { auth }                    from '@/lib/auth'
import { getAccessibilitySettings } from '@/app/actions/accessibility'
import AccessibilitySettingsView   from '@/components/accessibility/AccessibilitySettingsView'

export default async function AccessibilitySettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session.user as any

  const settings = await getAccessibilitySettings(user.id)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-bold text-gray-900">Accessibility</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Personalise your experience. Settings are saved to your account and apply on every device.
        </p>
      </div>
      <AccessibilitySettingsView initialSettings={settings} userId={user.id} />
    </div>
  )
}
