import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import DemoRolePicker from './DemoRolePicker'

export const metadata = { title: 'Demo — Omnis' }

export default async function DemoPage() {
  const user = await requireAuth('PLATFORM_ADMIN')
  // Only the demo owner reaches this page via the root redirect
  if (user.email !== 'ivanyardley@me.com') redirect('/platform-admin/dashboard')
  return <DemoRolePicker firstName={user.firstName} />
}
