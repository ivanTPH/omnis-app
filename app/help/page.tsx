import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import HelpView from '@/components/help/HelpView'

export default async function HelpPage() {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <HelpView role={role} />
    </AppShell>
  )
}
