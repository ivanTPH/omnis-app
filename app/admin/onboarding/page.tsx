import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppShell from '@/components/AppShell'
import OnboardingWizard from '@/components/admin/OnboardingWizard'

export default async function OnboardingPage() {
  const { role, firstName, lastName, schoolName, schoolId } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')

  const school = await prisma.school.findUnique({
    where: { id: schoolId as string },
    select: { id: true, name: true, phase: true, urn: true, emailDomain: true, onboardedAt: true },
  })

  if (!school) redirect('/dashboard')

  // Already onboarded — go to dashboard
  if (school.onboardedAt) redirect('/admin/dashboard')

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <main className="flex-1 overflow-auto bg-gray-50 flex items-start justify-center py-8 px-4">
        <OnboardingWizard
          school={{
            id:          school.id,
            name:        school.name,
            phase:       school.phase ?? '',
            urn:         school.urn ?? '',
            emailDomain: school.emailDomain ?? '',
          }}
        />
      </main>
    </AppShell>
  )
}
