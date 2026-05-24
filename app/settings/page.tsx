import { requireAuth } from '@/lib/session'
import { prisma }      from '@/lib/prisma'
import { redirect }    from 'next/navigation'
import AppShell        from '@/components/AppShell'
import SettingsShell   from '@/components/settings/SettingsShell'

export const metadata = { title: 'Settings — Omnis' }

export default async function SettingsPage() {
  const { id: userId, role, firstName, lastName, schoolName } = await requireAuth()

  const [user, settings] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: {
        id:         true,
        firstName:  true,
        lastName:   true,
        email:      true,
        role:       true,
        department: true,
        school:     { select: { name: true } },
      },
    }),
    prisma.userSettings.upsert({
      where:  { userId },
      create: { userId },
      update: {},
    }),
  ])

  if (!user) redirect('/login')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto">
        <SettingsShell user={user as any} settings={settings as any} />
      </main>
    </AppShell>
  )
}
