import { requireAuth }            from '@/lib/session'
import { redirect }               from 'next/navigation'
import AppShell                   from '@/components/AppShell'
import ResourceLibraryView        from '@/components/ResourceLibraryView'
import { getFullResourceLibrary } from '@/app/actions/lessons'

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>
}) {
  const { role, firstName, lastName, schoolName } = await requireAuth()

  const STAFF_ROLES = ['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN','COVER_MANAGER','TEACHING_ASSISTANT']
  if (!STAFF_ROLES.includes(role)) redirect('/student/dashboard')

  const sp         = await searchParams
  const typeFilter = sp.type && sp.type !== 'all' ? sp.type : undefined
  const query      = sp.q?.trim() || undefined

  const resources = await getFullResourceLibrary(typeFilter, query)

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <ResourceLibraryView resources={resources} initialType={sp.type} initialQuery={sp.q} />
    </AppShell>
  )
}
